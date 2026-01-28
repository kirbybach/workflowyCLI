import Conf from 'conf';
import chalk from 'chalk';
import type { IWorkflowyClient } from '../api/index.js'; // Use interface
import type { WorkflowyNode } from '../api/client.js';

interface TreeCache {
    syncedAt: number;
    root: WorkflowyNode[];
}

const cache = new Conf<{ tree: TreeCache }>({
    projectName: 'workflowycli-tree',
    clearInvalidConfig: true
});

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes standard TTL
const SYNC_TIMEOUT_MS = 60000;      // 60 seconds timeout (increased for larger trees)

export interface SearchResult {
    node: WorkflowyNode;
    path: PathSegment[]; // Breadcrumbs to this node
    matchField: 'name' | 'note';
    matchContent: string;
}

export interface PathSegment {
    id: string;
    name: string;
}

export interface SearchOptions {
    includeNotes?: boolean;
    limit?: number;
    isRegex?: boolean;
}

export class TreeSyncService {
    private client: IWorkflowyClient;
    private inMemoryTree: WorkflowyNode[] | null = null;
    private syncInProgress: Promise<WorkflowyNode[]> | null = null;
    private lastSyncedAt: number = 0;

    constructor(client: IWorkflowyClient) {
        this.client = client;
    }

    /**
     * Clear local cache (useful for debugging or forced reset)
     */
    clearCache() {
        cache.clear();
        this.inMemoryTree = null;
        this.lastSyncedAt = 0;
    }

    /**
     * Stale-While-Revalidate pattern:
     * 1. Return cached data immediately (if available)
     * 2. Trigger background refresh if stale
     * 3. Never block on network for reads unless fully empty
     */
    async getTree(forceRefresh = false): Promise<{ tree: WorkflowyNode[]; stale: boolean; syncingInBackground: boolean }> {
        // 1. Try in-memory cache (fastest)
        if (this.inMemoryTree && !forceRefresh) {
            const isStale = Date.now() - this.lastSyncedAt > CACHE_TTL_MS;
            if (isStale && !this.syncInProgress) {
                this.syncInBackground();
            }
            return { tree: this.inMemoryTree, stale: isStale, syncingInBackground: !!this.syncInProgress };
        }

        // 2. Try disk cache (fast)
        if (!this.inMemoryTree && !forceRefresh) {
            try {
                const cached = cache.get('tree');
                if (cached && Array.isArray(cached.root)) {
                    this.inMemoryTree = cached.root;
                    this.lastSyncedAt = cached.syncedAt;
                    const isStale = Date.now() - cached.syncedAt > CACHE_TTL_MS;

                    if (isStale && !this.syncInProgress) {
                        this.syncInBackground();
                    }
                    return { tree: cached.root, stale: isStale, syncingInBackground: !!this.syncInProgress };
                }
            } catch (e) {
                console.error("Failed to read cache, clearing:", e);
                cache.clear();
            }
        }

        // 3. No cache or forced refresh - must block
        const tree = await this.syncBlocking();
        return { tree, stale: false, syncingInBackground: false };
    }

    /**
     * Force a blocking sync (for `wf sync` command)
     */
    async forceSync(options: { showProgress?: boolean } = {}): Promise<WorkflowyNode[]> {
        return this.syncBlocking(options);
    }

    /**
     * Background sync - fire and forget
     */
    private syncInBackground(): void {
        if (this.syncInProgress) return;

        // Catch errors to avoid unhandled rejections in background
        this.syncInProgress = this.syncBlocking({ silent: true })
            .catch(e => {
                // Should we log background sync errors? Maybe just debug.
                // console.error("Background sync failed:", e.message);
                return this.inMemoryTree || []; // Return fallback
            })
            .finally(() => {
                this.syncInProgress = null;
            });
    }

    /**
     * Blocking sync with timeout and progress indication
     */
    private async syncBlocking(options: { showProgress?: boolean; silent?: boolean } = {}): Promise<WorkflowyNode[]> {
        // If already syncing, join the existing promise
        if (this.syncInProgress) {
            return this.syncInProgress;
        }

        const startTime = Date.now();
        let nodeCount = 0;

        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Sync timed out after 60 seconds')), SYNC_TIMEOUT_MS);
        });

        const syncTask = (async () => {
            return await this.fetchFullTree('None', (count) => {
                nodeCount = count;
                if (options.showProgress && !options.silent) {
                    process.stderr.write(`\rSyncing... ${nodeCount} nodes`);
                }
            });
        })();

        try {
            const tree = await Promise.race([syncTask, timeoutPromise]);

            // Cache it
            const now = Date.now();
            cache.set('tree', { syncedAt: now, root: tree });
            this.inMemoryTree = tree;
            this.lastSyncedAt = now;

            if (!options.silent && options.showProgress) {
                const elapsed = now - startTime;
                console.error(chalk.dim(`\rSynced ${nodeCount} nodes in ${elapsed}ms`));
            }

            return tree;
        } catch (e: any) {
            if (!options.silent) {
                console.error(chalk.red(`\nSync failed: ${e.message}`));
            }
            // Return stale cache if available
            if (this.inMemoryTree) {
                if (!options.silent) console.error(chalk.yellow('Using stale cache.'));
                return this.inMemoryTree;
            }
            throw e;
        }
    }

    // Expose for hybrid caching
    getInMemoryTree(): WorkflowyNode[] | null {
        return this.inMemoryTree;
    }

    /**
     * Recursively fetch the tree
     */
    private async fetchFullTree(
        parentId: string,
        onProgress?: (count: number) => void,
        runningCount = { value: 0 }
    ): Promise<WorkflowyNode[]> {
        const children = await this.client.getNodes(parentId);
        runningCount.value += children.length;
        if (onProgress && runningCount.value % 10 === 0) { // Update every 10 nodes to reduce I/O
            onProgress(runningCount.value);
        }

        // Recursively fetch descendants
        // We can now fire all requests in parallel; the Client's semaphore will throttle network calls.
        if (children.length > 0) {
            await Promise.all(children.map(async (child) => {
                child.ch = await this.fetchFullTree(child.id, onProgress, runningCount);
            }));
        }

        return children;
    }

    /**
     * Search the in-memory tree (instant, never blocks on network)
     */
    search(query: string, options: SearchOptions = {}): SearchResult[] {
        if (!this.inMemoryTree) {
            // If no tree, we can't search. Caller should ensure sync first.
            return [];
        }

        const results: SearchResult[] = [];
        this.searchRecursive(this.inMemoryTree, query.toLowerCase(), [], results, options);
        return results;
    }

    private searchRecursive(
        nodes: WorkflowyNode[],
        query: string,
        path: PathSegment[],
        results: SearchResult[],
        options: SearchOptions
    ) {
        let regex: RegExp | null = null;
        if (options.isRegex) {
            try {
                regex = new RegExp(query, 'i');
            } catch (e) {
                throw new Error(`Invalid regular expression: ${query}`);
            }
        }

        for (const node of nodes) {
            let nameMatch = false;
            let noteMatch = false;

            if (regex) {
                nameMatch = regex.test(node.name || '');
                noteMatch = !!options.includeNotes && regex.test(node.note || '');
            } else {
                nameMatch = (node.name || '').toLowerCase().includes(query);
                noteMatch = !!options.includeNotes && (node.note || '').toLowerCase().includes(query);
            }

            if (nameMatch || noteMatch) {
                results.push({
                    node,
                    path: path.slice(), // Clone current path
                    matchField: nameMatch ? 'name' : 'note',
                    matchContent: nameMatch ? node.name : (node.note || '')
                });

                if (options.limit && results.length >= options.limit) return;
            }

            if (node.ch && node.ch.length > 0) {
                const nextPath = [...path, { id: node.id, name: node.name }];
                this.searchRecursive(node.ch, query, nextPath, results, options);

                if (options.limit && results.length >= options.limit) return;
            }
        }
    }

    /**
     * Find a node by ID and return its path (requires synced tree)
     */
    findNodeById(targetId: string): { node: WorkflowyNode; path: PathSegment[] } | null {
        if (!this.inMemoryTree) return null;
        return this.findRecursive(this.inMemoryTree, targetId, []);
    }

    private findRecursive(
        nodes: WorkflowyNode[],
        targetId: string,
        path: PathSegment[]
    ): { node: WorkflowyNode; path: PathSegment[] } | null {
        for (const node of nodes) {
            if (node.id === targetId) {
                return { node, path };
            }
            if (node.ch) {
                const nextPath = [...path, { id: node.id, name: node.name }];
                const found = this.findRecursive(node.ch, targetId, nextPath);
                if (found) return found;
            }
        }
        return null;
    }
}
