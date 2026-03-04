import chalk from 'chalk';
import { Session } from '../state/session.js';
import { registerCommand } from './registry.js';
import type { CommandContext } from './registry.js';

registerCommand({
    name: 'get',
    description: 'Instantly fetch a node globally by ID',
    usage: 'get <id> [--json]',
    args: [
        { name: 'id', required: true, description: 'UUID of the node to fetch' }
    ],
    flags: [
        { name: 'json', description: 'Output as JSON', type: 'boolean' }
    ],
    handler: getHandler
});

async function getHandler(session: Session, { args, flags }: CommandContext): Promise<void> {
    const targetId = args[0]!;

    try {
        // We use the NodeService to get the node by ID from cache or sync
        let node = await session.nodeService.getNode(targetId);

        if (!node) {
            if (!flags.json) console.log(chalk.dim('Node not in cache, fetching...'));
            // If we don't have it, force a sync and try again
            await session.forceSync(!flags.json);
            node = await session.nodeService.getNode(targetId);
        }

        if (!node) {
            throw new Error(`Node not found globally: ${targetId}`);
        }

        // Get parent if available via path trace
        const pathInfo = (session.nodeService as any).getPathFromNode?.(targetId);
        const parentId = pathInfo && pathInfo.length > 1 ? pathInfo[pathInfo.length - 2].id : null;

        if (flags.json) {
            console.log(JSON.stringify({
                id: node.id,
                parentId: parentId || null,
                name: node.name,
                note: node.note || "",
                completed: !!node.completedAt
            }, null, 2));
        } else {
            console.log(chalk.bold('Name:'), node.name);
            console.log(chalk.bold('ID:'), node.id);
            if (parentId) console.log(chalk.bold('Parent ID:'), parentId);
            if (node.note) {
                console.log(chalk.bold('Note:'), node.note);
            }
            if (node.completedAt) {
                console.log(chalk.bold('Status:'), chalk.strikethrough('Completed'));
            }
        }

    } catch (e: any) {
        if (flags.json) {
            console.log(JSON.stringify({ error: e.message }));
            process.exitCode = 1;
        } else {
            console.error(chalk.red("Error reading node:"), e.message);
        }
    }
}
