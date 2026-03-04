import chalk from 'chalk';
import { Session } from '../state/session.js';
import { registerCommand } from './registry.js';
import type { CommandContext } from './registry.js';

registerCommand({
    name: 'insert',
    description: 'Insert a new node as a child of a specific UUID',
    usage: 'insert <parentId> <name> [note] [--json]',
    args: [
        { name: 'parentId', required: true, description: 'UUID of the parent node' },
        { name: 'name', required: true, description: 'Name of the new node' },
        { name: 'note', required: false, description: 'Optional note for the new node' }
    ],
    flags: [
        { name: 'json', description: 'Output as JSON', type: 'boolean' }
    ],
    handler: insertHandler
});

async function insertHandler(session: Session, { args, flags }: CommandContext): Promise<void> {
    const parentId = args[0]!;
    const name = args[1]!;
    const note = args[2] as string | undefined;

    try {
        // Ensure parent exists in cache
        let parentNode = await session.nodeService.getNode(parentId);

        if (!parentNode) {
            if (!flags.json) console.log(chalk.dim('Parent node not in cache, fetching...'));
            await session.forceSync(!flags.json);
            parentNode = await session.nodeService.getNode(parentId);
        }

        if (!parentNode) {
            throw new Error(`Parent node not found globally: ${parentId}`);
        }

        const newNode = await session.createNode(parentId, name, note);
        const newNodeId = newNode.id;

        if (flags.json) {
            console.log(JSON.stringify({
                success: true,
                node: {
                    id: newNodeId,
                    parentId: parentId,
                    name: name,
                    note: note || ""
                }
            }, null, 2));
        } else {
            console.log(chalk.green(`Successfully created node '${name}' under parent ${parentId}`));
            console.log(chalk.gray(`New ID: ${newNodeId}`));
        }

    } catch (e: any) {
        if (flags.json) {
            console.log(JSON.stringify({ error: e.message }));
            process.exitCode = 1;
        } else {
            console.error(chalk.red("Error creating node:"), e.message);
        }
    }
}
