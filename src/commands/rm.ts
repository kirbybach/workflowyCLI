import chalk from 'chalk';
import { Session } from '../state/session.js';
import { registerCommand } from './registry.js';
import type { CommandContext } from './registry.js';

// Register the rm command
registerCommand({
    name: 'rm',
    aliases: ['delete', 'del'],
    description: 'Delete a node',
    usage: 'rm -f <target> [--json]',
    args: [
        { name: 'target', required: true, description: 'Index or name of node to delete' }
    ],
    flags: [
        { name: 'force', alias: 'f', description: 'Confirm deletion (required)', type: 'boolean' }
    ],
    handler: rmHandler
});

async function rmHandler(session: Session, { args, flags }: CommandContext): Promise<void> {
    if (args.length === 0) {
        if (flags.json) {
            console.log(JSON.stringify({ error: 'Target is required' }, null, 2));
            process.exitCode = 1;
        } else {
            console.log(chalk.red("Usage: rm -f <target>"));
        }
        return;
    }

    if (!flags.force) {
        if (flags.json) {
            console.log(JSON.stringify({ error: 'Use -f flag to confirm deletion' }, null, 2));
            process.exitCode = 1;
        } else {
            console.log(chalk.yellow("Use -f flag to confirm: rm -f <target>"));
        }
        return;
    }

    try {
        const target = await session.resolveChild(args[0]!);
        if (!target) {
            if (flags.json) {
                console.log(JSON.stringify({ error: `Node not found: ${args[0]}` }, null, 2));
                process.exitCode = 1;
            } else {
                console.log(chalk.red(`Node not found: ${args[0]}`));
            }
            return;
        }

        await session.deleteNode(target.id);

        if (flags.json) {
            console.log(JSON.stringify({
                success: true,
                deleted: {
                    id: target.id,
                    name: target.name
                }
            }, null, 2));
        } else {
            console.log(chalk.yellow(`Deleted: ${target.name}`));
        }
    } catch (e: any) {
        if (flags.json) {
            console.log(JSON.stringify({ error: e.message }, null, 2));
            process.exitCode = 1;
        } else {
            console.error(chalk.red("Error deleting node:"), e.message);
        }
    }
}

// Legacy export for backward compatibility
export async function rm(session: Session, args: string[]) {
    const { parseArgs, getCommand } = await import('./registry.js');
    const def = getCommand('rm')!;
    const ctx = parseArgs(def, args);
    await rmHandler(session, ctx);
}
