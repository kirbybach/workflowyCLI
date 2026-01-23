import { Session } from '../state/session.js';
import chalk from 'chalk';

export async function refresh(session: Session) {
    try {
        console.log(chalk.gray("Refreshing..."));
        await session.getChildren(session.getCurrentNodeId(), true); // forceRefresh = true
        console.log(chalk.green("Refreshed."));
    } catch (e: any) {
        console.error(chalk.red("Error refreshing:"), e);
    }
}
