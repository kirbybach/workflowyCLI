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

    isCacheStale(): boolean {
        return this.syncService.isStale;
    }

    async syncSubtree(nodeId: string): Promise<void> {
        // Construct path context if possible to enable skeleton grafting
        let pathContext: PathSegment[] | undefined;

        // 1. Is it the current node?
        if (nodeId === this.currentNodeId) {
            pathContext = this.currentPath;
        } else {
            // 2. Is it in the current path (parent)?
            const index = this.currentPath.findIndex(p => p.id === nodeId);
            if (index !== -1) {
                pathContext = this.currentPath.slice(0, index + 1);
            }
        }
        const options: any = { showProgress: true };
        if (pathContext) options.pathContext = pathContext;

        await this.syncService.syncSubtree(nodeId, options);
    }

    async search(query: string, options?: SearchOptions, startNodeId: string = "None"): Promise<SearchResult[]> {
        // Ensure we have data (stale-while-revalidate)
        const { tree, syncingInBackground } = await this.syncService.getTree();

        // If syncing in background for the first time or tree is empty, we might want to wait?
        // But getTree blocks if no cache exists. So we are good.

        return this.syncService.search(query, options, startNodeId);
    }


    async init() {
        if (process.env.WF_RESET) {
            this.config.clear();
        }

        // Default to root (Persistence disabled per user request)
        this.currentPath = [{ id: "None", name: "/" }];
        this.currentNodeId = "None";
    }

    private saveState() {
        // No-op: Persistence disabled
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
        if (pathStr === '~') {
            this.currentPath = [{ id: "None", name: "/" }];
            this.currentNodeId = "None";
            return;
        }

        if (pathStr.startsWith('~/')) {
            this.currentPath = [{ id: "None", name: "/" }];
            this.currentNodeId = "None";
            pathStr = pathStr.slice(2);
        } else if (pathStr.startsWith('/')) {
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

        this.saveState();
    }

    // Resolves a path to a node without changing state
    async resolvePath(pathStr: string): Promise<WorkflowyNode | null> {
        let currentId = this.currentNodeId;
        // Track a simulated path stack for handling '..'
        let pathStack = [...this.currentPath];

        if (pathStr === "~") return { id: "None", name: "/" } as any;

        if (pathStr.startsWith('~/')) {
            currentId = "None"; // Root
            pathStack = [{ id: "None", name: "/" }];
            pathStr = pathStr.slice(2);
        } else if (pathStr.startsWith('/')) {
            currentId = "None"; // Root
            pathStack = [{ id: "None", name: "/" }];
            pathStr = pathStr.slice(1);
        }

        const segments = pathStr.split('/').filter(s => s && s !== '.');
        let currentNode: WorkflowyNode | null = null;

        // If start at root, we need to mock a root node if filtered out?
        // Actually resolveOneLevel needs a parentId.

        if (segments.length === 0) {
            if (currentId === "None") {
                return { id: "None", name: "/" } as any;
            } else {
                // We are in a subdirectory and path is effectively "."
                // We need to return the current node details.
                // Try to look it up in cache or just return a shell object with ID.
                // find command only uses ID.
                return { id: currentId, name: this.currentPath[this.currentPath.length - 1]?.name || "?" } as any;
            }
        }

        for (const segment of segments) {
            if (segment === '..') {
                // Go up one level using the path stack
                if (pathStack.length > 1) {
                    pathStack.pop();
                    const parent = pathStack[pathStack.length - 1];
                    if (parent) {
                        currentId = parent.id;
                        currentNode = { id: parent.id, name: parent.name } as WorkflowyNode;
                    }
                } else {
                    // Already at root, just return root
                    currentNode = { id: "None", name: "/" } as WorkflowyNode;
                }
                continue;
            }

            const nextNode = await this.resolveOneLevel(currentId, segment);
            if (!nextNode) return null;

            currentNode = nextNode;
            currentId = nextNode.id;
            pathStack.push({ id: nextNode.id, name: nextNode.name });
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
        this.syncService.addNodeToCache(parentId, newNode);
        return newNode;
    }

    async deleteNode(nodeId: string) {
        await this.client.deleteNode(nodeId);
        this.nodeCache.delete(this.currentNodeId);
        this.syncService.removeNodeFromCache(nodeId);
    }

    async updateNode(nodeId: string, updates: Partial<WorkflowyNode>) {
        await this.client.updateNode(nodeId, updates);
        this.nodeCache.delete(this.currentNodeId);
        this.syncService.updateNodeInCache(nodeId, updates);
    }

    async completeNode(nodeId: string) {
        await this.client.completeNode(nodeId);
        this.nodeCache.delete(this.currentNodeId);
        this.syncService.updateNodeInCache(nodeId, { completedAt: Date.now() });
    }

    async uncompleteNode(nodeId: string) {
        await this.client.uncompleteNode(nodeId);
        this.nodeCache.delete(this.currentNodeId);
        this.syncService.updateNodeInCache(nodeId, { completedAt: null });
    }

    async moveNode(nodeId: string, parentId: string, priority: number) {
        await this.client.moveNode(nodeId, parentId, priority);
        // Invalidate both source (current) and dest (parent) caches
        this.nodeCache.delete(parentId);
        this.nodeCache.delete(this.currentNodeId);
        // Note: Sync service update for move is complex (needs to preserve children), skipping for now.
        // This means moved nodes might appear in old location in 'find' until next sync.
    }
}
