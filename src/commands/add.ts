import chalk from 'chalk';
import { Session } from '../state/session.js';
import { registerCommand } from './registry.js';
import type { CommandContext } from './registry.js';

// Register the add command
registerCommand({
    name: 'add',
    aliases: ['a', 'new'],
    description: 'Create a new node',
    usage: 'add <name> [note] [--json]',
    args: [
        { name: 'name', required: true, description: 'Name of the new node' },
        { name: 'note', required: false, description: 'Optional note for the node' }
    ],
    handler: addHandler
});

async function addHandler(session: Session, { args, flags }: CommandContext): Promise<void> {
    if (args.length === 0) {
        if (flags.json) {
            console.log(JSON.stringify({ error: 'Name is required' }, null, 2));
            process.exitCode = 1;
        } else {
            console.log(chalk.red("Usage: add <name> [note]"));
        }
        return;
    }

    const name = args[0]!;
    const note = args.length > 1 ? args[1] : undefined;

    try {
        const parentId = session.getCurrentNodeId();
        const newNode = await session.createNode(parentId, name, note);

        if (flags.json) {
            const output = {
                success: true,
                node: {
                    id: newNode.id,
                    name: newNode.name,
                    note: newNode.note || null,
                    parentId
                }
            };
            console.log(JSON.stringify(output, null, 2));
        } else {
            console.log(chalk.green(`Created: ${name}`));
        }
    } catch (e: any) {
        if (flags.json) {
            console.log(JSON.stringify({ error: e.message }, null, 2));
            process.exitCode = 1;
        } else {
            console.error(chalk.red("Error creating node:"), e.message);
        }
    }
}

// Legacy export for backward compatibility
export async function add(session: Session, args: string[]) {
    const { parseArgs, getCommand } = await import('./registry.js');
    const def = getCommand('add')!;
    const ctx = parseArgs(def, args);
    await addHandler(session, ctx);
}
