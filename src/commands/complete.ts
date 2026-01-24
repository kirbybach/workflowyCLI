import chalk from 'chalk';
import { Session } from '../state/session.js';
import { registerCommand } from './registry.js';
import type { CommandContext } from './registry.js';

// Register the complete command
registerCommand({
    name: 'complete',
    aliases: ['done', 'check'],
    description: 'Toggle completion status of a node',
    usage: 'complete <target> [--json]',
    args: [
        { name: 'target', required: true, description: 'Index or name of node to complete/uncomplete' }
    ],
    handler: completeHandler
});

async function completeHandler(session: Session, { args, flags }: CommandContext): Promise<void> {
    if (args.length === 0) {
        if (flags.json) {
            console.log(JSON.stringify({ error: 'Target is required' }, null, 2));
            process.exitCode = 1;
        } else {
            console.log(chalk.red("Usage: complete <target>"));
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

        const wasCompleted = !!target.completedAt;

        if (wasCompleted) {
            await session.uncompleteNode(target.id);
        } else {
            await session.completeNode(target.id);
        }

        const newStatus = !wasCompleted;

        if (flags.json) {
            console.log(JSON.stringify({
                success: true,
                node: {
                    id: target.id,
                    name: target.name,
                    completed: newStatus,
                    action: newStatus ? 'completed' : 'uncompleted'
                }
            }, null, 2));
        } else {
            if (newStatus) {
                console.log(chalk.green(`Completed: ${target.name}`));
            } else {
                console.log(chalk.green(`Uncompleted: ${target.name}`));
            }
        }

    } catch (e: any) {
        if (flags.json) {
            console.log(JSON.stringify({ error: e.message }, null, 2));
            process.exitCode = 1;
        } else {
            console.error(chalk.red("Error toggling completion:"), e.message);
        }
    }
}

// Legacy export for backward compatibility
export async function complete(session: Session, args: string[]) {
    const { parseArgs, getCommand } = await import('./registry.js');
    const def = getCommand('complete')!;
    const ctx = parseArgs(def, args);
    await completeHandler(session, ctx);
}
