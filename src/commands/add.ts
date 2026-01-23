import { Session } from '../state/session.js';
import chalk from 'chalk';

export async function add(session: Session, args: string[]) {
    if (args.length === 0) {
        console.log(chalk.red("Usage: add <text> [note]"));
        return;
    }

    const name = args[0]!;
    const note = args.length > 1 ? args[1] : undefined;

    try {
        const parentId = session.getCurrentNodeId();
        await session.createNode(parentId, name, note);
        console.log(chalk.green(`Created: ${name}`));
    } catch (e: any) {
        console.error(chalk.red("Error creating node:"), e.message);
    }
}
