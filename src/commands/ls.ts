import boxen from 'boxen';
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

        const lines: string[] = [];
        let printedCount = 0;
        children.forEach((child, index) => {
            // Filter completed
            if (!showAll && child.completedAt) {
                return;
            }

            const indexStr = chalk.dim(`[${index + 1}]`); // 1-based index
            let name = child.name;
            if (!child.name || child.name.trim() === "") {
                name = chalk.italic.gray("(untitled)");
            }

            if (child.completedAt) {
                name = chalk.strikethrough(name); // Visual indicator
            }

            lines.push(`${indexStr} ${name}`);
            if (child.note) {
                const noteLines = child.note.split('\n');
                const firstLine = noteLines[0] || '';
                const hasMore = noteLines.length > 1 || firstLine.length > 50;
                const displayNote = firstLine.length > 50
                    ? firstLine.substring(0, 50) + '...'
                    : firstLine + (hasMore ? '...' : '');
                lines.push(chalk.dim(`    ${displayNote}`));
            }
            printedCount++;
        });

        if (printedCount === 0 && children.length > 0) {
            console.log(chalk.gray(`(all ${children.length} items are completed. use 'ls -a' to see them)`));
        } else if (lines.length > 0) {
            console.log(boxen(lines.join('\n'), { padding: 0, borderStyle: 'round', borderColor: 'gray', dimBorder: true }));
        }

    } catch (error: any) {
        console.error(chalk.red("Error listing nodes:"), error.message);
    }
}
