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
    const force = args.includes('-f');
    const filteredArgs = args.filter(a => a !== '-f');

    if (filteredArgs.length === 0) {
        console.log(chalk.red("Usage: rm [-f] <index> or <name>"));
        return;
    }

    try {
        const target = await session.resolveChild(filteredArgs[0]!);
        if (!target) {
            console.log(chalk.red(`Node not found: ${filteredArgs[0]}`));
            return;
        }

        if (!force) {
            const confirmed = await confirm(`Delete "${target.name}"? (y/N) `);
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
