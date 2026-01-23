import { Session } from '../state/session.js';
import chalk from 'chalk';
import type { WorkflowyNode } from '../api/client.js';

export async function tree(session: Session, args: string[]) {
    // Usage: tree [depth]
    const showAll = args.includes('-a');

    let maxDepth = 2;
    // Find numeric arg
    const numArg = args.find(a => !isNaN(parseInt(a, 10)));
    if (numArg) {
        maxDepth = parseInt(numArg, 10);
    }

    try {
        const rootId = session.getCurrentNodeId();
        console.log(chalk.blue(session.getCurrentPathString()));

        await printNode(session, rootId, 0, maxDepth, "", showAll);

    } catch (e: any) {
        console.error(chalk.red("Error showing tree:"), e.message);
    }
}

async function printNode(session: Session, nodeId: string, currentDepth: number, maxDepth: number, prefix: string = "", showAll: boolean) {
    if (currentDepth >= maxDepth) return;

    // Fetch children of this node
    // We reuse session.getChildren which caches.
    let children: WorkflowyNode[] = [];
    try {
        children = await session.getChildren(nodeId);
    } catch (e) {
        // failed to list children? accessible?
        return;
    }

    // Filter children first
    const visibleChildren = children.filter(c => showAll || !c.completedAt);
    const count = visibleChildren.length;

    for (let i = 0; i < count; i++) {
        const child = visibleChildren[i];
        if (!child) continue;

        const isLast = i === count - 1;
        const connector = isLast ? "└── " : "├── ";

        let name = child.name || chalk.italic.gray("(untitled)");
        if (child.completedAt) name = chalk.strikethrough(name);

        console.log(`${prefix}${connector}${name}`);

        // Recurse
        const newPrefix = prefix + (isLast ? "    " : "│   ");
        await printNode(session, child.id, currentDepth + 1, maxDepth, newPrefix, showAll);
    }
}
