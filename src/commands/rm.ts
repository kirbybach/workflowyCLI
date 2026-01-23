import { Session } from '../state/session.js';
import chalk from 'chalk';

export async function rm(session: Session, args: string[]) {
    if (args.length === 0) {
        console.log(chalk.red("Usage: rm <index> or <name>"));
        return;
    }

    try {
        const target = await session.resolveChild(args[0]!);
        if (!target) {
            console.log(chalk.red(`Node not found: ${args[0]}`));
            return;
        }

        await session.deleteNode(target.id);
        console.log(chalk.yellow(`Deleted: ${target.name}`));
    } catch (e: any) {
        console.error(chalk.red("Error deleting node:"), e.message);
    }
}
