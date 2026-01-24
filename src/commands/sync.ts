import chalk from 'chalk';
import { Session } from '../state/session.js';
import { registerCommand } from './registry.js';
import type { CommandContext } from './registry.js';

// Register the sync command
registerCommand({
    name: 'sync',
    description: 'Force a full sync of the Workflowy tree',
    usage: 'sync [--json]',
    handler: syncHandler
});

async function syncHandler(session: Session, { flags }: CommandContext): Promise<void> {
    try {
        if (!flags.json) {
            console.log(chalk.blue("Starting full sync..."));
        }

        const startTime = Date.now();
        await session.forceSync(!flags.json);
        const elapsed = Date.now() - startTime;

        if (flags.json) {
            console.log(JSON.stringify({ success: true, durationMs: elapsed }, null, 2));
        } else {
            console.log(chalk.green(`Sync completed in ${elapsed}ms.`));
        }

    } catch (e: any) {
        if (flags.json) {
            console.log(JSON.stringify({ error: e.message }, null, 2));
            process.exitCode = 1;
        } else {
            console.error(chalk.red("Error syncing:"), e.message);
        }
    }
}
