import { Session } from '../state/session.js';
import chalk from 'chalk';

export async function complete(session: Session, args: string[]) {
    if (args.length === 0) {
        console.log(chalk.red("Usage: complete <target>"));
        return;
    }

    try {
        const target = await session.resolveChild(args[0]!);
        if (!target) {
            console.log(chalk.red(`Node not found: ${args[0]}`));
            return;
        }

        const isCompleted = !!target.completedAt;
        if (isCompleted) {
            await session.uncompleteNode(target.id);
            console.log(chalk.green(`Uncompleted: ${target.name}`));
        } else {
            await session.completeNode(target.id);
            console.log(chalk.green(`Completed: ${target.name}`));
        }

    } catch (e: any) {
        console.error(chalk.red("Error toggling completion:"), e.message);
    }
}
