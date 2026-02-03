import type { IWorkflowyClient, WorkflowyNode } from '../api/index.js';
import { TreeSyncService } from './sync.js';
import type { PathSegment, SearchResult, SearchOptions } from './types.js';




export class NodeService {
    private client: IWorkflowyClient;
    private syncService: TreeSyncService;
    private nodeCache: Map<string, WorkflowyNode[]> = new Map();

    constructor(client: IWorkflowyClient) {
        this.client = client;
        this.syncService = new TreeSyncService(client);
    }

    getCachedChildrenSync(nodeId: string): WorkflowyNode[] | undefined {
        return this.nodeCache.get(nodeId);
    }


    // --- Reads ---

    async getChildren(nodeId: string, forceRefresh = false): Promise<WorkflowyNode[]> {
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

    async getNode(nodeId: string): Promise<WorkflowyNode | null> {
        // Try cache first
        const cached = this.syncService.findNodeById(nodeId);
        if (cached) return cached.node;

        // Fallback: we might need to fetch the parent to find the node? 
        // Or can we fetch it directly? API is getNodes(parentId).
        // If we don't know the parent, we are stuck unless we search or sync.
        // For now, let's rely on SyncService's findNodeById which covers the tree.
        // If not in tree, we return null. Use forceSync() if you suspect it exists.
        return null;
    }

    // Helper from Session.ts
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

    // --- Mutations ---

    async createNode(parentId: string, name: string, note?: string): Promise<WorkflowyNode> {
        const newNode = await this.client.createNode(parentId, name, note);
        this.nodeCache.delete(parentId);
        this.syncService.addNodeToCache(parentId, newNode);
        return newNode;
    }

    async deleteNode(nodeId: string): Promise<void> {
        await this.client.deleteNode(nodeId);
        // We don't know the parent ID easily to invalidate nodeCache specific key,
        // but we can remove it from syncService.
        // For nodeCache, we might have stale children arrays. 
        // Ideally we invalidate everything or track parents.
        // Given current Session logic just cleared `this.currentNodeId` cache, 
        // we can be broader or just trust SyncService.
        this.nodeCache.clear(); // Safest approach for now
        this.syncService.removeNodeFromCache(nodeId);
    }

    async updateNode(nodeId: string, updates: Partial<WorkflowyNode>): Promise<void> {
        await this.client.updateNode(nodeId, updates);
        this.nodeCache.clear(); // Invalidate safely
        this.syncService.updateNodeInCache(nodeId, updates);
    }

    async completeNode(nodeId: string): Promise<void> {
        await this.client.completeNode(nodeId);
        this.nodeCache.clear();
        this.syncService.updateNodeInCache(nodeId, { completedAt: Date.now() });
    }

    async uncompleteNode(nodeId: string): Promise<void> {
        await this.client.uncompleteNode(nodeId);
        this.nodeCache.clear();
        this.syncService.updateNodeInCache(nodeId, { completedAt: null });
    }

    async moveNode(nodeId: string, parentId: string, priority: number): Promise<void> {
        await this.client.moveNode(nodeId, parentId, priority);
        this.nodeCache.clear();
        // Sync service update for move is complex/not implemented in original session.ts either
    }

    // --- Sync Passthrough ---

    async forceSync(showProgress = false): Promise<void> {
        await this.syncService.forceSync({ showProgress });
    }

    isCacheStale(): boolean {
        return this.syncService.isStale;
    }

    async search(query: string, options?: SearchOptions, startNodeId: string = "None"): Promise<SearchResult[]> {
        // Ensure we have data (stale-while-revalidate)
        await this.syncService.getTree();
        return this.syncService.search(query, options, startNodeId);
    }

    // Additional helpers referenced in plan
    getPathFromNode(nodeId: string) {
        return this.syncService.findNodeById(nodeId)?.path;
    }

    async syncSubtree(nodeId: string, pathContext?: PathSegment[]) {
        const options: any = { showProgress: true };
        if (pathContext) options.pathContext = pathContext;
        return this.syncService.syncSubtree(nodeId, options);
    }
}
