import chalk from 'chalk';
import { Session } from '../state/session.js';
import { registerCommand } from './registry.js';
import type { CommandContext } from './registry.js';
import type { WorkflowyNode } from '../api/index.js';

// Register the tree command
registerCommand({
    name: 'tree',
    description: 'Show visual tree of children',
    usage: 'tree [path] [depth] [-a] [--json]',
    args: [
        { name: 'arg1', required: false, description: 'Path or depth' },
        { name: 'arg2', required: false, description: 'Path or depth' }
    ],
    flags: [
        { name: 'all', alias: 'a', description: 'Show completed items', type: 'boolean' }
    ],
    handler: treeHandler
});

interface TreeNode {
    id: string;
    name: string;
    note: string | null;
    completed: boolean;
    children?: TreeNode[];
}

async function treeHandler(session: Session, { args, flags }: CommandContext): Promise<void> {
    let maxDepth = 2;
    let rootId = session.getCurrentNodeId();
    let displayPath = session.getCurrentPathString();

    // Parse mixed arguments (depth vs path)
    for (const arg of args) {
        if (!arg) continue;

        // Check if strict number
        if (/^\d+$/.test(arg)) {
            maxDepth = parseInt(arg, 10);
        } else {
            // Assume path
            const node = await session.resolvePath(arg);
            if (!node) {
                throw new Error(`Path not found: ${arg}`);
            }
            rootId = node.id;
            displayPath = arg;
        }
    }

    try {
        if (flags.json) {
            // Build tree structure for JSON output
            const treeData = await buildTreeJson(session, rootId, 0, maxDepth, flags.all as boolean);
            const output = {
                path: displayPath,
                maxDepth,
                tree: treeData
            };
            console.log(JSON.stringify(output, null, 2));
            return;
        }

        // Pretty output
        console.log(chalk.blue(displayPath));
        await printNode(session, rootId, 0, maxDepth, "", flags.all as boolean);

    } catch (e: any) {
        if (flags.json) {
            console.log(JSON.stringify({ error: e.message }, null, 2));
            process.exitCode = 1;
        } else {
            console.error(chalk.red("Error showing tree:"), e.message);
        }
    }
}

async function buildTreeJson(
    session: Session,
    nodeId: string,
    currentDepth: number,
    maxDepth: number,
    showAll: boolean
): Promise<TreeNode[]> {
    if (currentDepth >= maxDepth) return [];

    let children: WorkflowyNode[] = [];
    try {
        children = await session.getChildren(nodeId);
    } catch {
        return [];
    }

    const visibleChildren = children.filter(c => showAll || !c.completedAt);

    const result: TreeNode[] = [];
    for (const child of visibleChildren) {
        const node: TreeNode = {
            id: child.id,
            name: child.name,
            note: child.note || null,
            completed: !!child.completedAt
        };

        const childNodes = await buildTreeJson(session, child.id, currentDepth + 1, maxDepth, showAll);
        if (childNodes.length > 0) {
            node.children = childNodes;
        }

        result.push(node);
    }

    return result;
}

async function printNode(
    session: Session,
    nodeId: string,
    currentDepth: number,
    maxDepth: number,
    prefix: string = "",
    showAll: boolean
): Promise<void> {
    if (currentDepth >= maxDepth) return;

    let children: WorkflowyNode[] = [];
    try {
        children = await session.getChildren(nodeId);
    } catch {
        return;
    }

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

        const newPrefix = prefix + (isLast ? "    " : "│   ");
        await printNode(session, child.id, currentDepth + 1, maxDepth, newPrefix, showAll);
    }
}

// Legacy export for backward compatibility
export async function tree(session: Session, args: string[]) {
    const { parseArgs, getCommand } = await import('./registry.js');
    const def = getCommand('tree')!;
    const ctx = parseArgs(def, args);
    await treeHandler(session, ctx);
}
