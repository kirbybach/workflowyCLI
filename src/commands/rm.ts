import { Session } from '../state/session.js';
import chalk from 'chalk';

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

export async function rm(session: Session, args: string[]) {
    const force = args.includes('-f') || args.includes('--force');
    const filteredArgs = args.filter(a => a !== '-f' && a !== '--force');

    if (filteredArgs.length === 0) {
        console.log(chalk.red("Usage: rm [-f|--force] <index> or <name>"));
        return;
    }

    try {
        const target = await session.resolveChild(filteredArgs[0]!);
        if (!target) {
            console.log(chalk.red(`Node not found: ${filteredArgs[0]}`));
            return;
        }

        if (!force) {
            // TTY check: fail fast in non-interactive mode
            if (!process.stdin.isTTY) {
                console.error(chalk.red("Error: Cannot prompt for confirmation in non-interactive mode."));
                console.error(chalk.red("Use -f or --force to delete without confirmation."));
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
        console.log(chalk.yellow(`Deleted: ${target.name}`));
    } catch (e: any) {
        console.error(chalk.red("Error deleting node:"), e.message);
    }
}

