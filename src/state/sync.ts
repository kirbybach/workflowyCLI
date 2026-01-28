import Conf from 'conf';
import chalk from 'chalk';
import { isMockMode, type IWorkflowyClient } from '../api/index.js'; // Use interface
import type { WorkflowyNode } from '../api/client.js';

interface TreeCache {
    syncedAt: number;
    root: WorkflowyNode[];
}

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
    private cache: Conf<{ tree: TreeCache }>;
    private inMemoryTree: WorkflowyNode[] | null = null;
    private syncInProgress: Promise<WorkflowyNode[]> | null = null;
    private lastSyncedAt: number = 0;

    constructor(client: IWorkflowyClient) {
        this.client = client;

        const suffix = isMockMode() ? '-mock' : '';
        this.cache = new Conf<{ tree: TreeCache }>({
            projectName: `workflowycli-tree${suffix}`,
            clearInvalidConfig: true
        });
    }

    /**
     * Clear local cache (useful for debugging or forced reset)
     */
    clearCache() {
        this.cache.clear();
        this.inMemoryTree = null;
        this.lastSyncedAt = 0;
    }

    get isStale(): boolean {
        // If not loaded, try loading first
        if (!this.inMemoryTree) {
            this.tryLoadCache();
        }
        // If still no tree, it is "stale" (needs sync)
        if (!this.inMemoryTree) return true;

        return Date.now() - this.lastSyncedAt > CACHE_TTL_MS;
    }

    private tryLoadCache(): boolean {
        if (this.inMemoryTree) return true;
        try {
            const cached = this.cache.get('tree');
            if (cached && Array.isArray(cached.root)) {
                this.inMemoryTree = cached.root;
                this.lastSyncedAt = cached.syncedAt;
                return true;
            }
        } catch (e) {
            console.error("Failed to read cache:", e);
        }
        return false;
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
            if (this.tryLoadCache()) {
                const isStale = Date.now() - this.lastSyncedAt > CACHE_TTL_MS;
                if (isStale && !this.syncInProgress) {
                    this.syncInBackground();
                }
                return { tree: this.inMemoryTree!, stale: isStale, syncingInBackground: !!this.syncInProgress };
            }
        }

        // 3. No cache or forced refresh - must block
        // Show progress so the user doesn't think the CLI has hung
        const tree = await this.syncBlocking({ showProgress: true });
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
            this.cache.set('tree', { syncedAt: now, root: tree });
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
     * Partial Sync: Fetch only a specific subtree and graft it into the cache.
     * Does NOT update the global 'syncedAt' timestamp, protecting the "stale" status of the rest of the tree.
     */
    async syncSubtree(nodeId: string, options: { showProgress?: boolean; silent?: boolean, pathContext?: PathSegment[] } = {}): Promise<WorkflowyNode[]> {
        // 1. Ensure we have a base tree to graft onto (even if stale)
        if (!this.inMemoryTree) {
            // Try to load from cache first
            this.tryLoadCache();
        }

        if (!this.inMemoryTree) {
            // If still no tree, we must initialize a root at least
            // Or if we have pathContext, we can build a skeleton
            if (options.pathContext && options.pathContext.length > 0 && options.pathContext[0]?.id === 'None') {
                this.inMemoryTree = []; // Root is array of nodes? No, root is WorkflowyNode[].
                // Wait, inMemoryTree IS WorkflowyNode[]. That IS the root level items.
            } else {
                return this.syncBlocking(options);
            }
        }

        const startTime = Date.now();
        let nodeCount = 0;

        try {
            // 2. Fetch the subtree
            const subtree = await this.fetchFullTree(nodeId, (count) => {
                nodeCount = count;
                if (options.showProgress && !options.silent) {
                    process.stderr.write(`\rSyncing subtree... ${nodeCount} nodes`);
                }
            });

            // 3. Graft it: Find the node in memory and update its children
            let target = this.findNodeById(nodeId);

            // Skeleton Grafting: If target missing but we have path context, create stubs
            if (!target && options.pathContext && options.pathContext.length > 0) {
                if (!this.inMemoryTree) this.inMemoryTree = [];

                let currentLevel = this.inMemoryTree;

                // If pathContext[0] is Root, skip it.
                // If pathContext doesn't start with Root, search from top?
                // Assume pathContext is absolute from Root.

                for (let i = 1; i < options.pathContext.length; i++) {
                    const segment = options.pathContext[i];
                    if (!segment) continue;

                    if (segment.id === nodeId) {
                        // Target logic
                        let node = currentLevel.find(n => n.id === segment.id);
                        if (!node) {
                            node = {
                                id: segment.id,
                                name: segment.name,
                                ch: []
                            } as WorkflowyNode;
                            currentLevel.push(node);
                        }
                        node.ch = subtree;
                        target = { node, path: options.pathContext };
                        break;
                    }

                    // Intermediate logic
                    let node = currentLevel.find(n => n.id === segment.id);
                    if (!node) {
                        node = {
                            id: segment.id,
                            name: segment.name,
                            ch: []
                        } as WorkflowyNode;
                        currentLevel.push(node);
                    }
                    if (!node.ch) node.ch = [];
                    currentLevel = node.ch;
                }
            }

            if (target) {
                target.node.ch = subtree;

                // Persist the grafted tree (updates contents, preserves old syncedAt)
                // We use the OLD lastSyncedAt to ensure next global sync still runs if needed.
                this.cache.set('tree', {
                    syncedAt: this.lastSyncedAt,
                    root: this.inMemoryTree || [] // Ensure array
                });

                if (!options.silent && options.showProgress) {
                    const elapsed = Math.max(1, Date.now() - startTime);
                    console.error(chalk.dim(`\rPartially synced ${nodeCount} nodes in ${elapsed}ms`));
                }
                return subtree;
            } else {
                // Node not found and no context provided
                if (!options.silent) console.error(chalk.yellow("Target node not found in cache for grafting. Falling back to full sync."));
                return this.syncBlocking(options);
            }

        } catch (e: any) {
            if (!options.silent) console.error(chalk.red(`Partial sync failed: ${e.message}`));
            throw e;
        }
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
     * @param query Search term
     * @param options Search options
     * @param startNodeId Optional node ID to start search from (defaults to root)
     */
    search(query: string, options: SearchOptions = {}, startNodeId: string = "None"): SearchResult[] {
        if (!this.inMemoryTree) {
            // If no tree, we can't search. Caller should ensure sync first.
            return [];
        }

        let startNodes: WorkflowyNode[] = this.inMemoryTree;
        let initialPath: PathSegment[] = [];

        // If a specific start node is requested (and it's not root), find it
        if (startNodeId !== "None") {
            const found = this.findRecursive(this.inMemoryTree, startNodeId, []);
            if (found) {
                startNodes = [found.node];
                initialPath = found.path;
            } else {
                // If start node not found, return empty results (or throw?)
                return [];
            }
        }

        const results: SearchResult[] = [];
        this.searchRecursive(startNodes, query.toLowerCase(), initialPath, results, options);
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
