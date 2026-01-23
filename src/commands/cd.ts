import { Session } from '../state/session.js';
import chalk from 'chalk';

import Enquirer from 'enquirer';

export async function cd(session: Session, args: string[]) {
    // Usage: cd <target>
    // Target can be ".." or name or index

    if (args.length === 0) {
        try {
            const children = await session.getChildren();
            if (children.length === 0) {
                console.log(chalk.gray("(empty directory)"));
                return;
            }

            // Interactive selection
            const choices = children.map((c, i) => {
                let display = c.name;
                if (!display.trim()) display = "(untitled)";

                // Visual indicators in the list
                if (c.completedAt) {
                    display = chalk.strikethrough(display);
                }

                return {
                    name: (i + 1).toString(), // Return the 1-based index which changeDirectory handles
                    message: display,
                    value: (i + 1).toString()
                };
            });

            // Using 'any' cast for Enquirer to avoid strict type issues if types are missing
            const prompt = new (Enquirer as any).AutoComplete({
                name: 'target',
                message: 'Navigate to:',
                limit: 10,
                choices: choices
            });

            const answer = await prompt.run();
            await session.changeDirectory(answer);

        } catch (e: any) {
            // prompt cancelled (empty string or specific error)
            if (e.toString().includes("is not fully supported")) {
                console.log(chalk.red("Interactive mode not supported in this environment yet."));
            }
        }
        return;
    }

    const target = args.join(" "); // Allow spaces in names
    try {
        await session.changeDirectory(target);
    } catch (e: any) {
        console.error(chalk.red(e.message));
    }
}
