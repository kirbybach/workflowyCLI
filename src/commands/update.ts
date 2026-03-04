import chalk from 'chalk';
import { Session } from '../state/session.js';
import { registerCommand } from './registry.js';
import type { CommandContext } from './registry.js';

registerCommand({
    name: 'update',
    description: 'Update a node directly by its UUID',
    usage: 'update <id> [--name="text"] [--note="text"] [--json]',
    args: [
        { name: 'id', required: true, description: 'UUID of the node to update' }
    ],
    flags: [
        { name: 'name', description: 'New name for the node', type: 'string' },
        { name: 'note', description: 'New note for the node', type: 'string' },
        { name: 'json', description: 'Output as JSON', type: 'boolean' }
    ],
    handler: updateHandler
});

async function updateHandler(session: Session, { args, flags }: CommandContext): Promise<void> {
    const targetId = args[0]!;

    const newName = flags.name as string | undefined;
    const newNote = flags.note as string | undefined;

    if (newName === undefined && newNote === undefined) {
        if (flags.json) {
            console.log(JSON.stringify({ error: 'Must provide --name or --note flag to update.' }));
            process.exitCode = 1;
        } else {
            console.error(chalk.red("Error:"), "Must provide --name or --note flag to update.");
        }
        return;
    }

    try {
        let node = await session.nodeService.getNode(targetId);

        if (!node) {
            if (!flags.json) console.log(chalk.dim('Node not in cache, fetching...'));
            await session.forceSync(!flags.json);
            node = await session.nodeService.getNode(targetId);
        }

        if (!node) {
            throw new Error(`Node not found globally: ${targetId}`);
        }

        // Apply updates
        const updates: any = {};
        if (newName !== undefined) updates.name = newName;
        if (newNote !== undefined) updates.note = newNote;

        await session.updateNode(targetId, updates);

        // Re-fetch to confirm change
        const updatedNode = await session.nodeService.getNode(targetId);

        if (flags.json) {
            console.log(JSON.stringify({
                success: true,
                node: {
                    id: updatedNode?.id,
                    name: updatedNode?.name,
                    note: updatedNode?.note || ""
                }
            }, null, 2));
        } else {
            console.log(chalk.green(`Successfully updated node ${targetId}`));
        }

    } catch (e: any) {
        if (flags.json) {
            console.log(JSON.stringify({ error: e.message }));
            process.exitCode = 1;
        } else {
            console.error(chalk.red("Error updating node:"), e.message);
        }
    }
}
