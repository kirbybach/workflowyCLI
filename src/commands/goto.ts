import chalk from 'chalk';
import { Session } from '../state/session.js';
import { BookmarkService } from '../state/bookmarks.js';
import { registerCommand } from './registry.js';
import type { CommandContext } from './registry.js';

const bookmarks = new BookmarkService();

registerCommand({
    name: 'goto',
    description: 'Jump to a bookmarked location',
    usage: 'goto <name|bookmark> [--json]',
    args: [
        { name: 'name', required: true, description: 'Bookmark name or ID to jump to' }
    ],
    flags: [
        { name: 'json', description: 'Output as JSON', type: 'boolean' }
    ],
    handler: gotoHandler
});

async function gotoHandler(session: Session, { args, flags }: CommandContext): Promise<void> {
    const targetName = args[0] || 'list';

    // List mode if no args (or explicit list?) - Command logic says required but if user hacks
    // Wait, let's implement list if "list" is passed or check? No, 'mark' and 'goto' pattern usually mark <name>.
    // But listing bookmarks is useful. Maybe `goto` without args lists them?
    // My registry required args: { required: true }. So user must provide name.

    // Check if bookmark exists
    const bookmark = bookmarks.get(targetName);
    let targetId = targetName;
    let targetPathHint = "";

    if (bookmark) {
        targetId = bookmark.nodeId;
        targetPathHint = bookmark.path;
    } else {
        // Assume ID?
        if (targetName.length < 10) {
            if (flags.json) {
                console.log(JSON.stringify({ error: `Bookmark '${targetName}' not found` }));
            } else {
                console.log(chalk.red(`Bookmark '${targetName}' not found. Use 'mark <name>' first.`));
                // List available?
                const all = bookmarks.list();
                if (all.length > 0) {
                    console.log(chalk.dim("Available bookmarks: " + all.map(b => b.name).join(", ")));
                }
            }
            return;
        }
        // If long, treat as ID
    }

    // Try to find path via Sync Service
    // We need access to sync service. It's private in Session but verify access?
    // I added getInMemoryTree to Session? No, getChildren checks it.
    // I should expose `findNodePath(id)` on Session or access sync service via property if public?
    // Session doesn't expose syncService publicly.

    // Quick Fix: Add `session.jumpToId(id)` method? It encapsulates the logic correctly.
    // Or expose syncService. Let's add `jumpToNodeId(id)` to Session.

    try {
        await session.jumpToNodeId(targetId, targetPathHint);
        if (flags.json) {
            console.log(JSON.stringify({ success: true, path: session.getCurrentPathString() }, null, 2));
        } else {
            console.log(chalk.green(`Jumped to ${session.getCurrentPathString()}`));
        }
    } catch (e: any) {
        if (flags.json) {
            console.log(JSON.stringify({ error: e.message }));
        } else {
            console.error(chalk.red("Jump failed:"), e.message);
        }
    }
}
