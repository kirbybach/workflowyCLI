import chalk from 'chalk';
import clipboardy from 'clipboardy';
import { Session } from '../state/session.js';
import type { WorkflowyNode } from '../api/client.js';

export async function copy(session: Session, args: string[]) {
    // Usage: copy [index]

    let text = "";

    if (args.length > 0) {
        // Copy specific child (and its subtree)
        const arg = args[0]; // defined because length > 0
        if (!arg) return;

        const index = parseInt(arg, 10);
        if (isNaN(index)) {
            console.error(chalk.red("Usage: copy [index]"));
            return;
        }

        const children = await session.getChildren();
        const child = children[index - 1];

        if (!child) {
            console.error(chalk.red(`Item ${index} not found.`));
            return;
        }

        console.log(chalk.gray(`Copying '${child.name}'...`));
        text = await buildNodeTree(session, child, 0);

    } else {
        // Copy all children of current view
        console.log(chalk.gray("Copying list..."));
        const parentId = session.getCurrentNodeId();
        const children = await session.getChildren(parentId);

        for (const child of children) {
            if (child.completedAt) continue;
            text += await buildNodeTree(session, child, 0);
        }
    }

    if (!text) {
        console.log(chalk.yellow("Nothing to copy."));
        return;
    }

    try {
        await clipboardy.write(text);
        console.log(chalk.green("Copied to clipboard!"));
    } catch (e: any) {
        console.error(chalk.red("Error copying:"), e.message);
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
