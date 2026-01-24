import chalk from 'chalk';
import clipboardy from 'clipboardy';
import { Session } from '../state/session.js';
import type { WorkflowyNode } from '../api/client.js';
import { registerCommand } from './registry.js';
import type { CommandContext } from './registry.js';

registerCommand({
    name: 'copy',
    description: 'Copy node content to clipboard',
    usage: 'copy [index] [--json]',
    args: [
        { name: 'index', required: false, description: 'Index of child node to copy (default: current view)' }
    ],
    flags: [
        { name: 'json', description: 'Output as JSON', type: 'boolean' }
    ],
    handler: copyHandler
});

async function copyHandler(session: Session, { args, flags }: CommandContext) {
    let text = "";
    let statusMessage = "";

    try {
        if (args.length > 0) {
            // Copy specific child (and its subtree)
            const arg = args[0]!;
            const index = parseInt(arg, 10);

            if (isNaN(index)) {
                throw new Error("Index must be specific number");
            }

            const children = await session.getChildren();
            const child = children[index - 1];

            if (!child) {
                throw new Error(`Item ${index} not found.`);
            }

            statusMessage = `Copying '${child.name}'...`;
            if (!flags.json) console.log(chalk.gray(statusMessage));

            text = await buildNodeTree(session, child, 0);

        } else {
            // Copy all children of current view
            statusMessage = "Copying list...";
            if (!flags.json) console.log(chalk.gray(statusMessage));

            const parentId = session.getCurrentNodeId();
            const children = await session.getChildren(parentId);

            for (const child of children) {
                if (child.completedAt) continue;
                text += await buildNodeTree(session, child, 0);
            }
        }

        if (!text) {
            if (flags.json) {
                console.log(JSON.stringify({ success: false, message: "Nothing to copy" }));
            } else {
                console.log(chalk.yellow("Nothing to copy."));
            }
            return;
        }

        await clipboardy.write(text);

        if (flags.json) {
            console.log(JSON.stringify({ success: true, bytes: text.length }, null, 2));
        } else {
            console.log(chalk.green("Copied to clipboard!"));
        }

    } catch (e: any) {
        if (flags.json) {
            console.log(JSON.stringify({ error: e.message }));
        } else {
            console.error(chalk.red("Error copying:"), e.message);
        }
    }
}

async function buildNodeTree(session: Session, node: WorkflowyNode, depth: number): Promise<string> {
    const indent = "  ".repeat(depth);
    let out = `${indent}- ${node.name}`;
    if (node.note) {
        out += `\n${indent}  ${node.note}`;
    }
    out += "\n";

    // Recurse
    const children = await session.getChildren(node.id);
    for (const child of children) {
        if (child.completedAt) continue;
        out += await buildNodeTree(session, child, depth + 1);
    }

    return out;
}
