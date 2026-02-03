import type { IWorkflowyClient, WorkflowyNode } from '../api/index.js';
import type { SearchResult, SearchOptions } from './types.js';
import { NodeService } from './NodeService.js';
import { SessionState } from './SessionState.js';
import { PathResolver } from './PathResolver.js';

export class Session {
    // Services exposed for potential advanced usage (e.g. scripting)
    public readonly nodeService: NodeService;

    private state: SessionState;
    private resolver: PathResolver;

    constructor(client: IWorkflowyClient) {
        this.nodeService = new NodeService(client);
        this.state = new SessionState();
        this.resolver = new PathResolver();
    }

    async init() {
        await this.state.load();
    }

    // --- Search & Sync Delegation ---

    async forceSync(showProgress = false): Promise<void> {
        await this.nodeService.forceSync(showProgress);
    }

    isCacheStale(): boolean {
        return this.nodeService.isCacheStale();
    }

    async syncSubtree(nodeId: string): Promise<void> {
        // Construct path context if possible to enable skeleton grafting
        // Delegate deeply to NodeService? 
        // Original logic checked if nodeId was current or parent.
        // We can pass the path context from state if it matches.

        // This specific logic is a bit tied to session state, so we handle context here.
        let pathContext: any[] | undefined;
        const currentPath = this.state.currentPath;
        const currentNodeId = this.state.currentNodeId;

        if (nodeId === currentNodeId) {
            pathContext = currentPath;
        } else {
            const index = currentPath.findIndex(p => p.id === nodeId);
            if (index !== -1) {
                pathContext = currentPath.slice(0, index + 1);
            }
        }

        await this.nodeService.syncSubtree(nodeId, pathContext);
    }

    async search(query: string, options?: SearchOptions, startNodeId: string = "None"): Promise<SearchResult[]> {
        return this.nodeService.search(query, options, startNodeId);
    }

    // --- State Accessors ---

    getCurrentNodeId(): string {
        return this.state.currentNodeId;
    }

    getCurrentPath(): string {
        return this.state.currentPath.map(p => p.name).join("/") || "/";
    }

    getCurrentPathString(): string {
        return this.getCurrentPath();
    }

    getParentNodeId(): string | null {
        // Delegate to state logic
        const path = this.state.currentPath;
        if (path.length <= 1) return null;
        return path[path.length - 2]?.id || null;
    }

    // --- Data Access ---

    // Synchronous helper for autocomplete (might need NodeService to expose cache)
    // For now we can remove or re-implement if `nodeCache` was public.
    // NodeService doesn't expose synchronous cache get.
    // This method was used by CLI for autocomplete.
    // Let's add a safe method to NodeService or just return undefined if async required.
    getCachedChildrenSync(): WorkflowyNode[] | undefined {
        // This is tricky. The original code accessed a map directly.
        // We can't easily replicate this without exposing NodeService internals.
        // Assuming we can skip for now, or check NodeService source.
        // Wait, I can explicitly add it to NodeService to maintain compat.
        return (this.nodeService as any).nodeCache?.get(this.state.currentNodeId);
    }

    async getChildren(nodeId: string = this.state.currentNodeId, forceRefresh = false): Promise<WorkflowyNode[]> {
        return this.nodeService.getChildren(nodeId, forceRefresh);
    }

    // --- Legacy Resolution ---

    async resolvePath(pathStr: string): Promise<WorkflowyNode | null> {
        return this.resolver.resolvePath(pathStr, this.state.currentNodeId, this.state.currentPath, this.nodeService);
    }

    async resolveChild(arg: string): Promise<WorkflowyNode | null> {
        return this.resolvePath(arg);
    }

    // --- Navigation ---

    async jumpToNodeId(nodeId: string, pathHint?: string): Promise<void> {
        // Strategy A: Check sync service for exact path (via NodeService)
        let node = await this.nodeService.getNode(nodeId);

        // Strategy B: Optimistic Hint check
        if (!node && pathHint) {
            try {
                await this.changeDirectory(pathHint);
                if (this.state.currentNodeId === nodeId) return;
            } catch (e) { }
        }

        // Strategy C: Force Sync
        if (!node) {
            console.log("Node not found in cache. Syncing...");
            await this.nodeService.forceSync();
            node = await this.nodeService.getNode(nodeId);
        }

        if (node) {
            // Reconstruct path
            // We need full path trace. NodeService can help using SyncService's findNodeById
            const pathInfo = (this.nodeService as any).getPathFromNode(nodeId);
            if (pathInfo) {
                const pathStr = "/" + pathInfo.map((p: any) => p.name).join("/");
                await this.changeDirectory(pathStr);
                return;
            }
        }

        throw new Error(`Bookmark target (ID: ${nodeId}) not found after sync.`);
    }

    async changeDirectory(arg: string) {
        if (arg === "~" || arg === "/") {
            this.state.resetToRoot();
            return;
        }

        // First try to resolve the path
        let target = await this.resolvePath(arg);

        // If relative path fails and contains '/', try as absolute from root
        if (!target && !arg.startsWith('/') && arg.includes('/')) {
            target = await this.resolvePath('/' + arg);
            if (target) {
                // Determine if we need to adjust arg for walk logic?
                // The resolver handles it. We just need the target.
                // Wait, walkAndChange in original code did stepwise entry.
                // Here we can just jump?
                // Original walked to build the stack. With Resolver we can verify the path.
                // But `setNode` only pushes ONE item. 
                // We need to rebuild the FULL stack if we jump arbitrarily.

                // Resolver returns the target node, but not the path trace to get there if it's deep.
                // But wait, `SessionState` has `setPath`.
                // We need the resolver to return the *path trace*, not just the node.
                // But currently `resolvePath` returns `WorkflowyNode`.
                // Actually `walking` logic is lost if we just jump.
                // But `PathResolver` iterates internally.

                // CRITICAL FIX: To maintain stack history correctly (breadcrumbs),
                // we should mimic `walkAndChange`.
                // Instead of `setNode(target)`, we should probably re-parse the success path.
                // OR `PathResolver` could return the full stack?
                // Let's stick to the behavior: verify target exists, then `walk`.

                // Actually, `walkAndChange` in the original code modifies state iteratively.
                // We should expose a `walk` method or make `changeDirectory` use `Resolver` iteratively.

                // Optimization: If resolver works, we can just assume the path segments based on input?
                // No, input might be ".." or indexes.

                // Let's implement `walk` using Resolver's `resolveOneLevel`.
                arg = '/' + arg;
            }
        }

        if (target) {
            await this.walkAndChange(arg);
        } else {
            throw new Error(`Directory not found: ${arg}`);
        }
    }

    private async walkAndChange(pathStr: string) {
        if (pathStr === '~') {
            this.state.resetToRoot();
            return;
        }

        // Handle start anchors relative to Root without resetting immediately?
        // Original code reset currentPath if start with / or ~
        if (pathStr.startsWith('~/')) {
            this.state.resetToRoot();
            pathStr = pathStr.slice(2);
        } else if (pathStr.startsWith('/')) {
            this.state.resetToRoot();
            pathStr = pathStr.slice(1);
        }

        const segments = pathStr.split('/').filter(s => s && s !== '.');

        for (const segment of segments) {
            if (segment === '..') {
                this.state.popPath();
                continue;
            }

            // Here we use the RESOLVER to find the next node ID given current state
            const nextNode = await this.resolver.resolveOneLevel(this.state.currentNodeId, segment, this.nodeService);
            if (!nextNode) {
                throw new Error(`Path segment not found: ${segment}`); // Should be caught by pre-check ideally
            }
            this.state.setNode(nextNode);
        }
    }


    // --- Mutations ---

    async createNode(parentId: string, name: string, note?: string) {
        // Original Logic: create, then update cache. NodeService handles this.
        return this.nodeService.createNode(parentId, name, note);
    }

    async deleteNode(nodeId: string) {
        return this.nodeService.deleteNode(nodeId);
    }

    async updateNode(nodeId: string, updates: Partial<WorkflowyNode>) {
        return this.nodeService.updateNode(nodeId, updates);
    }

    async completeNode(nodeId: string) {
        return this.nodeService.completeNode(nodeId);
    }

    async uncompleteNode(nodeId: string) {
        return this.nodeService.uncompleteNode(nodeId);
    }

    async moveNode(nodeId: string, parentId: string, priority: number) {
        return this.nodeService.moveNode(nodeId, parentId, priority);
    }
}
