import boxen from 'boxen';
import chalk from 'chalk';
import { Session } from '../state/session.js';
import { registerCommand } from './registry.js';
import type { CommandContext } from './registry.js';

// Register the ls command
registerCommand({
    name: 'ls',
    aliases: ['list', 'dir'],
    description: 'List children of current node',
    usage: 'ls [path] [-a] [--json]',
    args: [
        { name: 'path', required: false, description: 'Path to list (default: current)' }
    ],
    flags: [
        { name: 'all', alias: 'a', description: 'Show completed items', type: 'boolean' }
    ],
    handler: lsHandler
});

async function lsHandler(session: Session, { args, flags }: CommandContext): Promise<void> {
    try {
        let targetNodeId = session.getCurrentNodeId();
        let targetPath = session.getCurrentPath();

        if (args.length > 0 && args[0]) {
            const pathStr = args[0];
            const node = await session.resolvePath(pathStr);
            if (!node) {
                throw new Error(`Path not found: ${pathStr}`);
            }
            targetNodeId = node.id;
            // Construct display path - if root, just /
            targetPath = node.name; // This is just name, not full path. 
            // We don't easily have full path of arbitrary node unless we trace parents.
            // But for listing we can just say "Listing: <name>" or similar.
            // For JSON path, we might want to be accurate.
            // But let's stick to node name or resolving path string if it was absolute.
            targetPath = pathStr;
        }

        const children = await session.getChildren(targetNodeId);
        const filtered = children.filter(c => flags.all || !c.completedAt);

        // JSON output mode
        if (flags.json) {
            const output = {
                path: targetPath,
                count: filtered.length,
                totalCount: children.length,
                children: filtered.map((c, i) => ({
                    index: i + 1,
                    id: c.id,
                    name: c.name,
                    note: c.note || null,
                    completed: !!c.completedAt,
                    completedAt: c.completedAt || null
                }))
            };
            console.log(JSON.stringify(output, null, 2));
            return;
        }

        // Pretty output mode
        if (children.length === 0) {
            console.log(chalk.gray("(empty)"));
            return;
        }

        const lines: string[] = [];
        let printedCount = 0;

        children.forEach((child, index) => {
            // Filter completed
            if (!flags.all && child.completedAt) {
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
        if (flags.json) {
            console.log(JSON.stringify({ error: error.message }, null, 2));
            process.exitCode = 1;
        } else {
            console.error(chalk.red("Error listing nodes:"), error.message);
        }
    }
}

// Legacy export for backward compatibility during migration
export async function ls(session: Session, args: string[]) {
    const { parseArgs, getCommand } = await import('./registry.js');
    const def = getCommand('ls')!;
    const ctx = parseArgs(def, args);
    await lsHandler(session, ctx);
}
