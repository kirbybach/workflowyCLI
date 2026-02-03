import type { PathSegment } from './types.js';
import type { NodeService } from './NodeService.js';
import type { WorkflowyNode } from '../api/index.js';

export class PathResolver {

    /**
     * Resolves a path string to a target node.
     * Returns null if any segment is not found.
     */
    async resolvePath(
        pathStr: string,
        currentId: string,
        currentPathStack: PathSegment[],
        nodeService: NodeService
    ): Promise<WorkflowyNode | null> {
        let lookupId = currentId;
        // Track a simulated path stack for handling '..'
        let pathStack = [...currentPathStack];

        if (pathStr === "~") return { id: "None", name: "/" } as any;

        if (pathStr.startsWith('~/')) {
            lookupId = "None"; // Root
            pathStack = [{ id: "None", name: "/" }];
            pathStr = pathStr.slice(2);
        } else if (pathStr.startsWith('/')) {
            lookupId = "None"; // Root
            pathStack = [{ id: "None", name: "/" }];
            pathStr = pathStr.slice(1);
        }

        const segments = pathStr.split('/').filter(s => s && s !== '.');
        let currentNode: WorkflowyNode | null = null;

        if (segments.length === 0) {
            if (lookupId === "None") {
                return { id: "None", name: "/" } as any;
            } else {
                // Return current node details shell
                return { id: lookupId, name: currentPathStack[currentPathStack.length - 1]?.name || "?" } as any;
            }
        }

        for (const segment of segments) {
            if (segment === '..') {
                // Go up one level using the path stack
                if (pathStack.length > 1) {
                    pathStack.pop();
                    const parent = pathStack[pathStack.length - 1];
                    if (parent) {
                        lookupId = parent.id;
                        currentNode = { id: parent.id, name: parent.name } as WorkflowyNode;
                    }
                } else {
                    // Already at root, just return root
                    currentNode = { id: "None", name: "/" } as WorkflowyNode;
                }
                continue;
            }

            const nextNode = await this.resolveOneLevel(lookupId, segment, nodeService);
            if (!nextNode) return null;

            currentNode = nextNode;
            lookupId = nextNode.id;
            pathStack.push({ id: nextNode.id, name: nextNode.name });
        }

        return currentNode;
    }

    async resolveOneLevel(parentId: string, arg: string, nodeService: NodeService): Promise<WorkflowyNode | null> {
        const children = await nodeService.getChildren(parentId);

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
}
