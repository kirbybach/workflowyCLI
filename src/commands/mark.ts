import chalk from 'chalk';
import { Session } from '../state/session.js';
import { registerCommand } from './registry.js';
import type { CommandContext } from './registry.js';
import { BookmarkService } from '../state/bookmarks.js';

const bookmarks = new BookmarkService();

registerCommand({
    name: 'mark',
    description: 'Bookmark the current location',
    usage: 'mark <name> [--json]',
    args: [
        { name: 'name', required: true, description: 'Name of the bookmark' }
    ],
    flags: [
        { name: 'json', description: 'Output as JSON', type: 'boolean' }
    ],
    handler: markHandler
});

async function markHandler(session: Session, { args, flags }: CommandContext): Promise<void> {
    if (args.length === 0) {
        if (flags.json) {
            console.log(JSON.stringify({ error: 'Name required' }));
            process.exitCode = 1;
        } else {
            console.error(chalk.red("Usage: mark <name>"));
        }
        return;
    }

    const name = args[0]!;
    const nodeId = session.getCurrentNodeId();
    const path = session.getCurrentPathString();

    bookmarks.save(name, nodeId, path);

    if (flags.json) {
        console.log(JSON.stringify({
            success: true,
            bookmark: { name, nodeId, path }
        }, null, 2));
    } else {
        console.log(chalk.green(`Bookmarked '${name}' at ${path}`));
    }
}
