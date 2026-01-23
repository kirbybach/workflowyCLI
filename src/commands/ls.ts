import chalk from 'chalk';
import { Session } from '../state/session.js';

export async function ls(session: Session, args: string[]) {
    const showAll = args.includes('-a');

    try {
        const children = await session.getChildren();
        if (children.length === 0) {
            console.log(chalk.gray("(empty)"));
            return;
        }

        let printedCount = 0;
        children.forEach((child, index) => {
            // Filter completed
            if (!showAll && child.completedAt) {
                return;
            }

            const indexStr = chalk.dim(`[${index + 1}]`); // 1-based index
            let name = child.name;
            if (child.name.trim() === "") {
                name = chalk.italic.gray("(untitled)");
            }

            if (child.completedAt) {
                name = chalk.strikethrough(name); // Visual indicator
            }

            console.log(`${indexStr} ${name}`);
            if (child.note) {
                console.log(chalk.dim(`    ${child.note.split('\n')[0]}...`));
            }
            printedCount++;
        });

        if (printedCount === 0 && children.length > 0) {
            console.log(chalk.gray(`(all ${children.length} items are completed. use 'ls -a' to see them)`));
        }

    } catch (error: any) {
        console.error(chalk.red("Error listing nodes:"), error.message);
    }
}
