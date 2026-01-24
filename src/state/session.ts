import type { IWorkflowyClient, WorkflowyNode } from '../api/index.js';

interface PathSegment {
    id: string; // Node ID
    name: string;
}

export class Session {
    private client: IWorkflowyClient;

    // Core Navigation State
    private currentPath: PathSegment[] = [];
    private currentNodeId: string = "None"; // Default start (Root)

    private nodeCache: Map<string, WorkflowyNode[]> = new Map();

    constructor(client: IWorkflowyClient) {
        this.client = client;
    }

    async init() {
        // API key validation moved to index.ts entry point
        this.currentPath = [{ id: "None", name: "/" }];
    }


    getCurrentNodeId(): string {
        return this.currentNodeId;
    }

    getCurrentPathString(): string {
        return this.currentPath.map(p => p.name).join("/");
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
        if (!forceRefresh && this.nodeCache.has(nodeId)) {
            return this.nodeCache.get(nodeId)!;
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

    async changeDirectory(arg: string) {
        if (arg === "..") {
            if (this.currentPath.length > 1) {
                this.currentPath.pop();
                const parent = this.currentPath[this.currentPath.length - 1];
                if (parent) {
                    this.currentNodeId = parent.id;
                }
                return;
            } else {
                return;
            }
        }

        // Handle "cd ~" or "cd /"
        if (arg === "~" || arg === "/") {
            this.currentPath = [{ id: "None", name: "/" }];
            this.currentNodeId = "None";
            return;
        }

        const target = await this.resolveChild(arg);
        if (target) {
            this.enterNode(target);
        } else {
            throw new Error(`Directory not found: ${arg}`);
        }
    }

    private enterNode(node: WorkflowyNode) {
        this.currentNodeId = node.id;
        this.currentPath.push({ id: node.id, name: node.name });
    }

    async resolveChild(arg: string): Promise<WorkflowyNode | null> {
        const children = await this.getChildren(this.currentNodeId);

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

        // 3. Fuzzy
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
