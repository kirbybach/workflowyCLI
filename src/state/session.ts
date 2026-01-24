import type { IWorkflowyClient, WorkflowyNode } from '../api/index.js';
import { TreeSyncService, type SearchResult, type SearchOptions } from './sync.js';
import Conf from 'conf';
import { isMockMode } from '../api/index.js';

const PROJECT_NAME = 'workflowycli-session';

interface PathSegment {
    id: string; // Node ID
    name: string;
}

export class Session {
    private client: IWorkflowyClient;
    private syncService: TreeSyncService;

    private currentPath: PathSegment[] = [];
    private currentNodeId: string = "None"; // Default start (Root)

    private nodeCache: Map<string, WorkflowyNode[]> = new Map();
    private config: Conf<{ lastPath: PathSegment[] }>;

    constructor(client: IWorkflowyClient) {
        this.client = client;
        this.syncService = new TreeSyncService(client);

        const suffix = isMockMode() ? '-mock' : '';
        this.config = new Conf({
            projectName: `${PROJECT_NAME}${suffix}`,
            clearInvalidConfig: true
        });
    }

    // --- Search & Sync Delegation ---

    async forceSync(showProgress = false): Promise<void> {
        await this.syncService.forceSync({ showProgress });
    }

    async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
        // Ensure we have data (stale-while-revalidate)
        const { tree, syncingInBackground } = await this.syncService.getTree();

        // If syncing in background for the first time or tree is empty, we might want to wait?
        // But getTree blocks if no cache exists. So we are good.

        return this.syncService.search(query, options);
    }


    async init() {
        // Always start at root
        this.currentPath = [{ id: "None", name: "/" }];
        this.currentNodeId = "None";
    }


    getCurrentNodeId(): string {
        return this.currentNodeId;
    }

    getCurrentPath(): string {
        return this.currentPath.map(p => p.name).join("/") || "/";
    }

    getCurrentPathString(): string {
        return this.getCurrentPath();
    }

    getParentNodeId(): string | null {
        if (this.currentPath.length <= 1) {
            return null; // Already at root
        }
        return this.currentPath[this.currentPath.length - 2]?.id || null;
    }

    // Synchronous helper for autocomplete
    getCachedChildrenSync(): WorkflowyNode[] | undefined {
        return this.nodeCache.get(this.currentNodeId);
    }

    async getChildren(nodeId: string = this.currentNodeId, forceRefresh = false): Promise<WorkflowyNode[]> {
        // 1. Check strict node cache (fastest)
        if (!forceRefresh && this.nodeCache.has(nodeId)) {
            return this.nodeCache.get(nodeId)!;
        }

        // 2. Check sync service cache (full tree)
        if (!forceRefresh) {
            const fullTree = this.syncService.getInMemoryTree();
            if (fullTree) {
                const cachedNode = this.findInTree(fullTree, nodeId);
                if (cachedNode && cachedNode.ch) {
                    // Update simple cache while we are here
                    this.nodeCache.set(nodeId, cachedNode.ch);
                    return cachedNode.ch;
                }
                // If it's root ("None")
                if (nodeId === "None") {
                    this.nodeCache.set(nodeId, fullTree);
                    return fullTree;
                }
            }
        }

        try {
            const children = await this.client.getNodes(nodeId);
            // Sort by priority (k)
            children.sort((a, b) => (a.k || 0) - (b.k || 0));
            this.nodeCache.set(nodeId, children);
            return children;
        } catch (error) {
            console.error("Failed to fetch node children:", error);
            throw error;
        }
    }

    private findInTree(nodes: WorkflowyNode[], targetId: string): WorkflowyNode | null {
        for (const node of nodes) {
            if (node.id === targetId) return node;
            if (node.ch) {
                const found = this.findInTree(node.ch, targetId);
                if (found) return found;
            }
        }
        return null;
    }

    async jumpToNodeId(nodeId: string, pathHint?: string): Promise<void> {
        // Strategy A: Check sync service for exact path
        let found = this.syncService.findNodeById(nodeId);

        // Strategy B: Optimistic Hint check
        if (!found && pathHint) {
            try {
                // Try navigating to hint
                await this.changeDirectory(pathHint);
                if (this.currentNodeId === nodeId) return; // Success!
                // If not match, maybe renamed. Continue to Strategy C.
            } catch (e) {
                // Hint failed
            }
        }

        // Strategy C: Force Sync and try A again
        if (!found) {
            console.log("Node not found in cache. Syncing...");
            await this.syncService.forceSync();
            found = this.syncService.findNodeById(nodeId);
        }

        if (found) {
            // Reconstruct path string
            // PathSegment[] -> string. Root is typically implicit or empty.
            // My paths usually start with Root ("/" with ID "None").
            // SyncService path excludes Root? Let's check search behavior.
            // searchRecursive starts with path=[]. 
            // If match is deep, path is [{id, name}, ...].
            // We need to convert this to "/Project/Item".

            // Assuming root is implicit.
            const pathStr = "/" + found.path.map(p => p.name).join("/");
            try {
                await this.changeDirectory(pathStr);
                return;
            } catch (e: any) {
                // Should not happen if sync is correct, unless path string issues
                console.error("Constructed path failed:", pathStr);
                throw e;
            }
        }

        throw new Error(`Bookmark target (ID: ${nodeId}) not found after sync.`);
    }

    async changeDirectory(arg: string) {
        if (arg === "~" || arg === "/") {
            this.currentPath = [{ id: "None", name: "/" }];
            this.currentNodeId = "None";
            return;
        }

        // First try to resolve the path
        let target = await this.resolvePath(arg);

        // If relative path fails and contains '/', try as absolute from root
        if (!target && !arg.startsWith('/') && arg.includes('/')) {
            target = await this.resolvePath('/' + arg);
            if (target) {
                arg = '/' + arg; // Update arg for walkAndChange
            }
        }

        if (target) {
            await this.walkAndChange(arg);
        } else {
            throw new Error(`Directory not found: ${arg}`);
        }
    }

    private enterNode(node: WorkflowyNode) {
        this.currentNodeId = node.id;
        this.currentPath.push({ id: node.id, name: node.name });
    }

    // Walks the path and updates state step-by-step to maintain breadcrumbs
    private async walkAndChange(pathStr: string) {
        // Handle absolute start
        if (pathStr.startsWith('/')) {
            this.currentPath = [{ id: "None", name: "/" }];
            this.currentNodeId = "None";
            pathStr = pathStr.slice(1);
        }

        const segments = pathStr.split('/').filter(s => s && s !== '.');

        for (const segment of segments) {
            if (segment === '..') {
                if (this.currentPath.length > 1) {
                    this.currentPath.pop();
                    const parent = this.currentPath[this.currentPath.length - 1];
                    if (parent) this.currentNodeId = parent.id;
                }
                continue;
            }

            const nextNode = await this.resolveOneLevel(this.currentNodeId, segment);
            if (!nextNode) {
                throw new Error(`Path segment not found: ${segment}`);
            }
            this.enterNode(nextNode);
        }
    }

    // Resolves a path to a node without changing state
    async resolvePath(pathStr: string): Promise<WorkflowyNode | null> {
        let currentId = this.currentNodeId;

        if (pathStr.startsWith('/')) {
            currentId = "None"; // Root
            pathStr = pathStr.slice(1);
        }

        if (pathStr === "~") return { id: "None", name: "/" } as any;

        const segments = pathStr.split('/').filter(s => s && s !== '.');
        let currentNode: WorkflowyNode | null = null;

        // If start at root, we need to mock a root node if filtered out?
        // Actually resolveOneLevel needs a parentId.

        if (segments.length === 0 && currentId === "None") {
            return { id: "None", name: "/" } as any;
        }

        for (const segment of segments) {
            if (segment === '..') {
                // Not supported in pure resolution without parent context, 
                // unless we cache parents or fetching parent ID.
                // Session has getParentNodeId() but that relies on breadcrumbs 
                // which match currentId only if we start from currentId.
                // Supporting '..' in arbitrary paths is hard without back-links.
                // We'll skip specific '..' support for now in arbitrary paths unless it's supported by cached breadcrumbs logic.
                // For now, simplified: '..' only works relative to CWD in changeDirectory, not general paths?
                // Or we assume we can't resolve '..' easily.
                return null;
            }

            const nextNode = await this.resolveOneLevel(currentId, segment);
            if (!nextNode) return null;

            currentNode = nextNode;
            currentId = nextNode.id;
        }

        return currentNode;
    }

    // Legacy alias, acts as resolvePath now
    async resolveChild(arg: string): Promise<WorkflowyNode | null> {
        return this.resolvePath(arg);
    }

    // Core resolution logic for a single segment
    async resolveOneLevel(parentId: string, arg: string): Promise<WorkflowyNode | null> {
        const children = await this.getChildren(parentId);

        // 1. Try Index
        const index = parseInt(arg, 10);
        if (!isNaN(index)) {
            if (index >= 1 && index <= children.length) {
                return children[index - 1] || null;
            }
        }

        // 2. Exact Name
        const exactMatches = children.filter(c => c.name === arg);
        if (exactMatches.length === 1) {
            return exactMatches[0] || null;
        }

        // 3. UUID Match
        const uuidMatch = children.find(c => c.id === arg);
        if (uuidMatch) return uuidMatch;

        // 4. Fuzzy
        const fuzzyMatches = children.filter(c => c.name.toLowerCase().startsWith(arg.toLowerCase()));
        if (fuzzyMatches.length === 1) {
            return fuzzyMatches[0] || null;
        }

        return null;
    }

    // --- Mutation Methods ---

    async createNode(parentId: string, name: string, note?: string) {
        const newNode = await this.client.createNode(parentId, name, note);
        this.nodeCache.delete(parentId);
        return newNode;
    }

    async deleteNode(nodeId: string) {
        await this.client.deleteNode(nodeId);
        this.nodeCache.delete(this.currentNodeId);
    }

    async updateNode(nodeId: string, updates: Partial<WorkflowyNode>) {
        await this.client.updateNode(nodeId, updates);
        this.nodeCache.delete(this.currentNodeId);
    }

    async completeNode(nodeId: string) {
        await this.client.completeNode(nodeId);
        this.nodeCache.delete(this.currentNodeId);
    }

    async uncompleteNode(nodeId: string) {
        await this.client.uncompleteNode(nodeId);
        this.nodeCache.delete(this.currentNodeId);
    }

    async moveNode(nodeId: string, parentId: string, priority: number) {
        await this.client.moveNode(nodeId, parentId, priority);
        // Invalidate both source (current) and dest (parent) caches
        this.nodeCache.delete(parentId);
        this.nodeCache.delete(this.currentNodeId);
    }
}
