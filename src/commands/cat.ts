import chalk from 'chalk';
import { Session } from '../state/session.js';
import { registerCommand } from './registry.js';
import type { CommandContext } from './registry.js';

registerCommand({
    name: 'cat',
    description: 'Display node details (name and note)',
    usage: 'cat <target> [--json]',
    args: [
        { name: 'target', required: true, description: 'Node to view' }
    ],
    flags: [
        { name: 'json', description: 'Output as JSON', type: 'boolean' }
    ],
    handler: catHandler
});

async function catHandler(session: Session, { args, flags }: CommandContext): Promise<void> {
    const targetArg = args[0]!;

    try {
        const node = await session.resolvePath(targetArg);
        if (!node) {
            throw new Error(`Node not found: ${targetArg}`);
        }

        if (flags.json) {
            console.log(JSON.stringify({
                id: node.id,
                name: node.name,
                note: node.note || "",
                completed: !!node.completedAt
            }, null, 2));
        } else {
            console.log(chalk.bold(node.name));
            if (node.note) {
                console.log(node.note);
            }
        }

    } catch (e: any) {
        if (flags.json) {
            console.log(JSON.stringify({ error: e.message }));
        } else {
            console.error(chalk.red("Error reading node:"), e.message);
        }
    }
}
