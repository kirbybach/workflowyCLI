import { Session } from '../state/session.js';
import chalk from 'chalk';
import { registerCommand } from './registry.js';
import type { CommandContext } from './registry.js';

registerCommand({
    name: 'cd',
    description: 'Change current directory',
    usage: 'cd <path> [--json]',
    args: [
        { name: 'path', required: false, description: 'Path to navigate to (default: /)' }
    ],
    flags: [
        { name: 'json', description: 'Output as JSON', type: 'boolean' }
    ],
    handler: cdHandler
});

async function cdHandler(session: Session, { args, flags }: CommandContext) {
    let target = "/";

    if (args.length > 0) {
        // Allow unquoted spaces by joining args
        target = args.join(" ");
    }

    try {
        await session.changeDirectory(target);

        if (flags.json) {
            console.log(JSON.stringify({
                success: true,
                path: session.getCurrentPathString()
            }, null, 2));
        } else {
            // cd is usually silent on success
        }
    } catch (e: any) {
        if (flags.json) {
            console.log(JSON.stringify({ error: e.message }));
        } else {
            console.error(chalk.red(e.message));
        }
    }
}

