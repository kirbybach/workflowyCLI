import { Session } from '../state/session.js';
import chalk from 'chalk';
import { registerCommand } from './registry.js';

registerCommand({
    name: 'refresh',
    description: 'Refresh the current view from server',
    usage: 'refresh',
    handler: async (session: Session) => {
        try {
            console.log(chalk.gray("Refreshing..."));
            await session.getChildren(session.getCurrentNodeId(), true); // forceRefresh = true
            console.log(chalk.green("Refreshed."));
        } catch (e: any) {
            console.error(chalk.red("Error refreshing:"), e);
        }
    }
});
