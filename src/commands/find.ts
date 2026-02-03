import chalk from 'chalk';
import { Session } from '../state/session.js';
import { registerCommand } from './registry.js';
import type { CommandContext } from './registry.js';
import type { PathSegment } from '../state/types.js';

// Register the find command
registerCommand({
    name: 'find',
    aliases: ['search', 'f'],
    description: 'Search for nodes by text',
    usage: 'find [path] <query> [--notes] [--limit N] [--regex] [--json]',
    args: [
        { name: 'arg1', required: true, description: 'Path (optional) or Query' },
        { name: 'arg2', required: false, description: 'Query (if path provided)' }
    ],
    flags: [
        { name: 'notes', alias: 'n', description: 'Include notes in search', type: 'boolean' },
        { name: 'limit', alias: 'l', description: 'Max results (default: 50)', type: 'string' },
        { name: 'sync', alias: 's', description: 'Force full sync before searching', type: 'boolean' },
        { name: 'regex', alias: 'r', description: 'Treat query as a regular expression', type: 'boolean' }
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
            console.log(chalk.red("Usage: find [path] <query>"));
        }
        return;
    }

    let query: string;
    let pathArg: string | undefined;

    if (args[1]) {
        // Two arguments: find <path> <query>
        pathArg = args[0];
        query = args[1]!;
    } else {
        // One argument: find <query>
        // (Defaults to current directory)
        query = args[0]!;
    }

    const includeNotes = !!flags.notes;
    const isRegex = !!flags.regex;
    const limit = flags.limit ? parseInt(String(flags.limit), 10) : 50;

    try {
        // Sync Logic:
        // 1. If --sync flag is set, ALWAYS Force Sync (Global).
        // 2. If path is provided (Scoped Search) AND cache is stale, Partial Sync (Subtree).
        // 3. If no path (Global Search) AND cache is stale, Force Sync (Global) via search() implicit or explicit.

        // We need to check if cache is stale. 
        // Session doesn't expose isStale directly but we can use a heuristic or expose it.
        // I added isStale to Session's SyncService, but Session doesn't expose it.
        // Wait, I forgot to expose isStale in Session. I will do that in the next step or assume access.
        // Actually, session.search will implicitly sync if stale. So for global search we don't need to do anything.
        // But for scoped search, we want to AVOID the implicit global sync and do a partial one.

        let startNodeId = session.getCurrentNodeId();
        if (pathArg) {
            const startNode = await session.resolvePath(pathArg);
            if (!startNode) {
                // Check if user maybe typed "find query" but meant path? 
                // No, sticking to rules is safer. simpler.
                throw new Error(`Directory not found: ${pathArg}`);
            }
            startNodeId = startNode.id;
        }

        if (flags.sync) {
            if (!flags.json) process.stderr.write("Syncing tree...");
            await session.forceSync(!flags.json);
            if (!flags.json) console.error(chalk.green(" Done."));
        } else if (session.isCacheStale && session.isCacheStale()) {
            // CACHE IS STALE
            // Strategy:
            // 1. Partial Sync if searching a scoped subdirectory
            // 2. Global Sync (implicitly via search) if searching Root

            if (startNodeId !== "None") {
                // Scoped Search (Explicit Path OR Implicit CWD) -> Partial Sync
                // We only sync the target subtree.
                if (!flags.json) console.error(chalk.dim(`Cache stale. Syncing scope only (${startNodeId})...`));
                await session.syncSubtree(startNodeId);
            } else {
                // Global Search -> Let session.search handle the full sync
            }
        }

        // Perform search
        const results = await session.search(query, {
            includeNotes,
            limit,
            isRegex
        }, startNodeId);

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
