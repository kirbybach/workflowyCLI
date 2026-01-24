import chalk from 'chalk';
import { Session } from '../state/session.js';
import { registerCommand } from './registry.js';
import type { CommandContext } from './registry.js';
import type { PathSegment } from '../state/sync.js';

// Register the find command
registerCommand({
    name: 'find',
    aliases: ['search', 'f'],
    description: 'Search for nodes by text',
    usage: 'find <query> [--notes] [--limit N] [--json]',
    args: [
        { name: 'query', required: true, description: 'Text to search for' }
    ],
    flags: [
        { name: 'notes', alias: 'n', description: 'Include notes in search', type: 'boolean' },
        { name: 'limit', alias: 'l', description: 'Max results (default: 50)', type: 'string' },
        { name: 'sync', alias: 's', description: 'Force full sync before searching', type: 'boolean' }
    ],
    handler: findHandler
});

function formatBreadcrumbs(path: PathSegment[]): string {
    if (path.length === 0) return '/';
    return '/' + path.map(s => s.name).join('/');
}

async function findHandler(session: Session, { args, flags }: CommandContext): Promise<void> {
    if (args.length === 0) {
        if (flags.json) {
            console.log(JSON.stringify({ error: 'Query is required' }, null, 2));
            process.exitCode = 1;
        } else {
            console.log(chalk.red("Usage: find <query>"));
        }
        return;
    }

    const query = args[0]!;
    const includeNotes = !!flags.notes;
    const limit = flags.limit ? parseInt(String(flags.limit), 10) : 50;

    try {
        if (flags.sync) {
            if (!flags.json) process.stderr.write("Syncing tree...");
            await session.forceSync(!flags.json);
            if (!flags.json) console.error(chalk.green(" Done."));
        }

        // Perform search
        const results = await session.search(query, {
            includeNotes,
            limit
        });

        if (flags.json) {
            console.log(JSON.stringify({
                query,
                count: results.length,
                results: results.map(r => ({
                    id: r.node.id,
                    name: r.node.name,
                    note: r.node.note || null,
                    completed: !!r.node.completedAt,
                    matchField: r.matchField,
                    path: formatBreadcrumbs(r.path)
                }))
            }, null, 2));
            return;
        }

        // Pretty Output
        if (results.length === 0) {
            console.log(chalk.gray("No matches found."));
            return;
        }

        console.log(chalk.blue(`Found ${results.length} matches:`));

        results.forEach((r, i) => {
            const index = chalk.dim(`[${i + 1}]`);
            const path = chalk.dim(formatBreadcrumbs(r.path));

            let name = r.node.name;
            let note = r.node.note;

            // Highlight match
            if (r.matchField === 'name') {
                name = highlight(name, query);
            } else if (note) {
                note = highlight(note, query);
            }

            if (r.node.completedAt) {
                name = chalk.strikethrough(name);
            }

            console.log(`${index} ${path}`);
            console.log(`    ${chalk.bold(name)}`);
            if (note) {
                console.log(`    ${chalk.italic(note)}`);
            }
            console.log(""); // Spacer
        });

    } catch (e: any) {
        if (flags.json) {
            console.log(JSON.stringify({ error: e.message }, null, 2));
            process.exitCode = 1;
        } else {
            console.error(chalk.red("Error searching:"), e.message);
        }
    }
}

function highlight(text: string, term: string): string {
    // Simple case-insensitive highlight
    const regex = new RegExp(`(${escapeRegExp(term)})`, 'gi');
    return text.replace(regex, (match) => chalk.bgYellow.black(match));
}

function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
