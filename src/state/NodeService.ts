import type { IWorkflowyClient, WorkflowyNode } from '../api/index.js';
import { TreeSyncService } from './sync.js';
import type { PathSegment, SearchResult, SearchOptions } from './types.js';




export class NodeService {
    private client: IWorkflowyClient;
    private syncService: TreeSyncService;
    private nodeCache: Map<string, WorkflowyNode[]> = new Map();
    private flatCache: Map<string, WorkflowyNode> = new Map();

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
            
            // Update flat cache
            for (const child of children) {
                this.flatCache.set(child.id, child);
            }
            
            return children;
        } catch (error) {
            console.error("Failed to fetch node children:", error);
            throw error;
        }
    }

    async getNode(nodeId: string): Promise<WorkflowyNode | null> {
        // 1. Check flat cache (nodes seen during this session)
        if (this.flatCache.has(nodeId)) {
            return this.flatCache.get(nodeId)!;
        }

        // 2. Load disk cache into memory if not already there
        await this.syncService.getTree();

        // 3. Check sync service (full tree)
        const cached = this.syncService.findNodeById(nodeId);
        if (cached) {
            this.flatCache.set(nodeId, cached.node);
            return cached.node;
        }

        try {
            // 4. Direct API hit as last resort
            const node = await this.client.getNode(nodeId);
            if (node) this.flatCache.set(nodeId, node);
            return node;
        } catch (e) {
            return null;
        }
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
        this.flatCache.set(newNode.id, newNode);
        this.syncService.addNodeToCache(parentId, newNode);
        return newNode;
    }

    async deleteNode(nodeId: string): Promise<void> {
        await this.client.deleteNode(nodeId);
        this.nodeCache.clear();
        this.flatCache.delete(nodeId);
        this.syncService.removeNodeFromCache(nodeId);
    }

    async updateNode(nodeId: string, updates: Partial<WorkflowyNode>): Promise<WorkflowyNode> {
        const updatedNode = await this.client.updateNode(nodeId, updates);
        this.nodeCache.clear();
        // Update flat cache
        this.flatCache.set(nodeId, updatedNode);
        this.syncService.updateNodeInCache(nodeId, updates);
        return updatedNode;
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
