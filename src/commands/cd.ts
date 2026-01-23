import { Session } from '../state/session.js';
import chalk from 'chalk';

import Enquirer from 'enquirer';

export async function cd(session: Session, args: string[]) {
    // Usage: cd <target>
    // Target can be ".." or name or index

    if (args.length === 0) {
        try {
            await session.changeDirectory("/");
        } catch (e: any) {
            console.error(chalk.red(e.message));
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
