import chalk from 'chalk';
import { Session } from '../state/session.js';
import { registerCommand } from './registry.js';
import type { CommandContext } from './registry.js';

// Register the rm command
registerCommand({
    name: 'rm',
    aliases: ['delete', 'del'],
    description: 'Delete a node',
    usage: 'rm [-f|--force] <target> [--json]',
    args: [
        { name: 'target', required: true, description: 'Index or name of node to delete' }
    ],
    handler: rmHandler
});

async function confirm(message: string): Promise<boolean> {
    return new Promise((resolve) => {
        process.stdout.write(chalk.yellow(message));

        const onData = (data: Buffer) => {
            const answer = data.toString().trim().toLowerCase();
            process.stdin.removeListener('data', onData);
            process.stdin.setRawMode?.(true);
            resolve(answer === 'y');
        };

        process.stdin.setRawMode?.(false);
        process.stdin.once('data', onData);
    });
}

async function rmHandler(session: Session, { args, flags }: CommandContext): Promise<void> {
    if (args.length === 0) {
        if (flags.json) {
            console.log(JSON.stringify({ error: 'Target is required' }, null, 2));
            process.exitCode = 1;
        } else {
            console.log(chalk.red("Usage: rm [-f|--force] <target>"));
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

        if (!flags.force) {
            // TTY check: fail fast in non-interactive mode
            if (!process.stdin.isTTY) {
                const error = "Cannot prompt for confirmation in non-interactive mode. Use -f or --force.";
                if (flags.json) {
                    console.log(JSON.stringify({ error }, null, 2));
                } else {
                    console.error(chalk.red(`Error: ${error}`));
                }
                process.exitCode = 1;
                return;
            }

            // Get child count for warning
            const children = await session.getChildren(target.id);
            const childCount = children.length;
            const childWarning = childCount > 0 ? ` (${childCount} children)` : '';

            const confirmed = await confirm(`Delete "${target.name}"${childWarning}? (y/N) `);
            console.log(); // newline after answer
            if (!confirmed) {
                console.log(chalk.gray("Cancelled."));
                return;
            }
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
