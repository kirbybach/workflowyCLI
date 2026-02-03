#!/usr/bin/env node
import { Command } from 'commander';
import ora from 'ora';
import { createClient, isMockMode } from './api/index.js';
import { WorkflowyClient } from './api/client.js';
import { Session } from './state/session.js';
import { startRepl } from './cli/repl.js';

// Import commands to register them
import './commands/ls.js';
import './commands/tree.js';
import './commands/add.js';
import './commands/rm.js';
import './commands/complete.js';
import './commands/find.js';
import './commands/sync.js';
import './commands/cd.js';
import './commands/mv.js';
import './commands/copy.js';
import './commands/edit.js';
import './commands/refresh.js';
import './commands/clear.js';
import './commands/help.js';
import './commands/mark.js';
import './commands/goto.js';
import './commands/cat.js';
import './commands/export.js';
import './commands/import.js';

import { getCommand, parseArgs } from './commands/registry.js';

const program = new Command();

program
    .name('wf')
    .description('CLI for Workflowy')
    .version('1.0.0')
    .option('--mock', 'Use mock data instead of real Workflowy API')
    .hook('preAction', (thisCommand) => {
        // Set mock mode from flag before any command runs
        if (thisCommand.opts().mock) {
            process.env.WF_MOCK = '1';
        }
    });

program
    .command('login')
    .description('Set API Key')
    .argument('<key>', 'Your Workflowy API Key')
    .action((key) => {
        // Login always uses real client to save the key
        const client = new WorkflowyClient();
        client.setApiKey(key);
        console.log("API Key saved.");
    });

// Helper to create a session for one-off commands
async function createSession(): Promise<Session> {
    const client = createClient();

    if (!isMockMode() && !client.getApiKey()) {
        console.error("Please login first: wf login <key>");
        process.exit(1);
    }

    const session = new Session(client);
    await session.init();
    return session;
}

// --- Non-interactive commands ---

program
    .command('ls [path]')
    .description('List children of a node')
    .option('-a, --all', 'Show completed items')
    .option('--json', 'Output as JSON')
    .action(async (path, options) => {
        try {
            const session = await createSession();

            // Navigate to path if provided
            if (path) {
                await session.changeDirectory(path);
            }

            const cmdDef = getCommand('ls')!;
            const args: string[] = [];
            if (options.all) args.push('-a');
            if (options.json) args.push('--json');

            const ctx = parseArgs(cmdDef, args);
            await cmdDef.handler(session, ctx);
        } catch (e: any) {
            if (options.json) {
                console.log(JSON.stringify({ error: e.message }));
            } else {
                console.error(`Error: ${e.message}`);
            }
            process.exit(1);
        }
    });

program
    .command('tree [path]')
    .description('Show tree view of a node')
    .argument('[depth]', 'Maximum depth', '2')
    .option('-a, --all', 'Show completed items')
    .option('--json', 'Output as JSON')
    .action(async (path, depth, options) => {
        try {
            const session = await createSession();

            if (path && !isNaN(parseInt(path))) {
                // If path looks like a number, treat as depth
                depth = path;
                path = undefined;
            }

            if (path) {
                await session.changeDirectory(path);
            }

            const cmdDef = getCommand('tree')!;
            const args: string[] = [depth];
            if (options.all) args.push('-a');
            if (options.json) args.push('--json');

            const ctx = parseArgs(cmdDef, args);
            await cmdDef.handler(session, ctx);
        } catch (e: any) {
            if (options.json) {
                console.log(JSON.stringify({ error: e.message }));
            } else {
                console.error(`Error: ${e.message}`);
            }
            process.exit(1);
        }
    });

program
    .command('add <name> [note]')
    .description('Create a new node (use "-" to read name from stdin)')
    .option('-p, --path <path>', 'Path to create node in')
    .option('--json', 'Output as JSON')
    .action(async (name, note, options) => {
        try {
            const session = await createSession();

            // Support piping: read from stdin if name is "-"
            if (name === '-') {
                const chunks: Buffer[] = [];
                for await (const chunk of process.stdin) {
                    chunks.push(chunk);
                }
                const input = Buffer.concat(chunks).toString('utf8').trim();

                if (input) name = input;

                if (!name || name === '-') {
                    throw new Error('No input received from stdin');
                }
            }

            if (options.path) {
                await session.changeDirectory(options.path);
            }

            const cmdDef = getCommand('add')!;
            const args: string[] = [name];
            if (note) args.push(note);
            if (options.json) args.push('--json');

            const ctx = parseArgs(cmdDef, args);
            await cmdDef.handler(session, ctx);
        } catch (e: any) {
            if (options.json) {
                console.log(JSON.stringify({ error: e.message }));
            } else {
                console.error(`Error: ${e.message}`);
            }
            process.exit(1);
        }
    });
// (Duplicate block removed)

program
    .command('rm <target>')
    .description('Delete a node')
    .option('-p, --path <path>', 'Path containing the target')
    .option('-f, --force', 'Skip confirmation')
    .option('--json', 'Output as JSON')
    .action(async (target, options) => {
        try {
            const session = await createSession();

            if (options.path) {
                await session.changeDirectory(options.path);
            }

            const cmdDef = getCommand('rm')!;
            const args: string[] = [target];
            if (options.force) args.push('-f');
            if (options.json) args.push('--json');

            const ctx = parseArgs(cmdDef, args);
            await cmdDef.handler(session, ctx);
        } catch (e: any) {
            if (options.json) {
                console.log(JSON.stringify({ error: e.message }));
            } else {
                console.error(`Error: ${e.message}`);
            }
            process.exit(1);
        }
    });

program
    .command('complete <target>')
    .description('Toggle completion status')
    .option('-p, --path <path>', 'Path containing the target')
    .option('--json', 'Output as JSON')
    .action(async (target, options) => {
        try {
            const session = await createSession();

            if (options.path) {
                await session.changeDirectory(options.path);
            }

            const cmdDef = getCommand('complete')!;
            const args: string[] = [target];
            if (options.json) args.push('--json');

            const ctx = parseArgs(cmdDef, args);
            await cmdDef.handler(session, ctx);
        } catch (e: any) {
            if (options.json) {
                console.log(JSON.stringify({ error: e.message }));
            } else {
                console.error(`Error: ${e.message}`);
            }
            process.exit(1);
        }
    });

program
    .command('find <arg1> [arg2]')
    .description('Search for nodes (usage: find [path] <query> or find <query>)')
    .option('-n, --notes', 'Include notes in search')
    .option('-l, --limit <number>', 'Limit results')
    .option('--sync', 'Force sync before searching')
    .option('-r, --regex', 'Treat query as a regular expression')
    .option('--json', 'Output as JSON')
    .action(async (arg1, arg2, options) => {
        try {
            const session = await createSession();

            const cmdDef = getCommand('find')!;
            const args: string[] = [arg1];
            if (arg2) args.push(arg2);

            if (options.notes) args.push('--notes');
            if (options.limit) args.push('--limit', options.limit);
            if (options.sync) args.push('--sync');
            if (options.regex) args.push('--regex');
            if (options.json) args.push('--json');

            const ctx = parseArgs(cmdDef, args);
            await cmdDef.handler(session, ctx);
            // Explicitly exit to prevent background sync timers from keeping process alive
            process.exit(0);
        } catch (e: any) {
            if (options.json) {
                console.log(JSON.stringify({ error: e.message }));
            } else {
                console.error(`Error: ${e.message}`);
            }
            process.exit(1);
        }
    });

program
    .command('sync')
    .description('Force a full tree sync')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
        try {
            const session = await createSession();

            const cmdDef = getCommand('sync')!;
            const args: string[] = [];
            if (options.json) args.push('--json');

            const ctx = parseArgs(cmdDef, args);
            await cmdDef.handler(session, ctx);
        } catch (e: any) {
            if (options.json) {
                console.log(JSON.stringify({ error: e.message }));
            } else {
                console.error(`Error: ${e.message}`);
            }
            process.exit(1);
        }
    });

program
    .command('cd [path]')
    .description('Change current directory (persists to session)')
    .option('--json', 'Output as JSON')
    .action(async (path, options) => {
        try {
            const session = await createSession();

            const cmdDef = getCommand('cd')!;
            const args: string[] = [];
            if (path) args.push(path);
            if (options.json) args.push('--json');

            const ctx = parseArgs(cmdDef, args);
            await cmdDef.handler(session, ctx);
        } catch (e: any) {
            if (options.json) {
                console.log(JSON.stringify({ error: e.message }));
            } else {
                console.error(`Error: ${e.message}`);
            }
            process.exit(1);
        }
    });

program
    .command('refresh')
    .description('Refresh the current view from server')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
        try {
            const session = await createSession();

            const cmdDef = getCommand('refresh')!;
            const args: string[] = [];
            if (options.json) args.push('--json');

            const ctx = parseArgs(cmdDef, args);
            await cmdDef.handler(session, ctx);
        } catch (e: any) {
            if (options.json) {
                console.log(JSON.stringify({ error: e.message }));
            } else {
                console.error(`Error: ${e.message}`);
            }
            process.exit(1);
        }
    });

program
    .command('mv <source> <destination>')
    .description('Move a node')
    .option('--json', 'Output as JSON')
    .action(async (source, destination, options) => {
        try {
            const session = await createSession();

            const cmdDef = getCommand('mv')!;
            const args: string[] = [source, destination];
            if (options.json) args.push('--json');

            const ctx = parseArgs(cmdDef, args);
            await cmdDef.handler(session, ctx);
        } catch (e: any) {
            if (options.json) {
                console.log(JSON.stringify({ error: e.message }));
            } else {
                console.error(`Error: ${e.message}`);
            }
            process.exit(1);
        }
    });

program
    .command('copy [index]')
    .description('Copy node to clipboard')
    .option('--json', 'Output as JSON')
    .action(async (index, options) => {
        try {
            const session = await createSession();

            const cmdDef = getCommand('copy')!;
            const args: string[] = [];
            if (index) args.push(index);
            if (options.json) args.push('--json');

            const ctx = parseArgs(cmdDef, args);
            await cmdDef.handler(session, ctx);
        } catch (e: any) {
            if (options.json) {
                console.log(JSON.stringify({ error: e.message }));
            } else {
                console.error(`Error: ${e.message}`);
            }
            process.exit(1);
        }
    });

program
    .command('edit <target> [new_text]')
    .description('Edit a node')
    .option('--json', 'Output as JSON')
    .action(async (target, new_text, options) => {
        try {
            const session = await createSession();

            const cmdDef = getCommand('edit')!;
            const args: string[] = [target];
            if (new_text) args.push(new_text);
            if (options.json) args.push('--json');

            const ctx = parseArgs(cmdDef, args);
            await cmdDef.handler(session, ctx);
        } catch (e: any) {
            if (options.json) {
                console.log(JSON.stringify({ error: e.message }));
            } else {
                console.error(`Error: ${e.message}`);
            }
            process.exit(1);
        }
    });

program
    .command('mark <name>')
    .description('Bookmark current location')
    .option('--json', 'Output as JSON')
    .action(async (name, options) => {
        try {
            const session = await createSession();

            const cmdDef = getCommand('mark')!;
            const args: string[] = [name];
            if (options.json) args.push('--json');

            const ctx = parseArgs(cmdDef, args);
            await cmdDef.handler(session, ctx);
        } catch (e: any) {
            if (options.json) {
                console.log(JSON.stringify({ error: e.message }));
            } else {
                console.error(`Error: ${e.message}`);
            }
            process.exit(1);
        }
    });

program
    .command('goto <name>')
    .description('Jump to bookmark')
    .option('--json', 'Output as JSON')
    .action(async (name, options) => {
        try {
            const session = await createSession();

            const cmdDef = getCommand('goto')!;
            const args: string[] = [name];
            if (options.json) args.push('--json');

            const ctx = parseArgs(cmdDef, args);
            await cmdDef.handler(session, ctx);
        } catch (e: any) {
            if (options.json) {
                console.log(JSON.stringify({ error: e.message }));
            } else {
                console.error(`Error: ${e.message}`);
            }
            process.exit(1);
        }
    });

program
    .command('cat <target>')
    .description('Display node details')
    .option('--json', 'Output as JSON')
    .action(async (target, options) => {
        try {
            const session = await createSession();

            const cmdDef = getCommand('cat')!;
            const args: string[] = [target];
            if (options.json) args.push('--json');

            const ctx = parseArgs(cmdDef, args);
            await cmdDef.handler(session, ctx);
        } catch (e: any) {
            if (options.json) {
                console.log(JSON.stringify({ error: e.message }));
            } else {
                console.error(`Error: ${e.message}`);
            }
            process.exit(1);
        }
    });

program
    .command('export [target]')
    .description('Export node tree to various formats')
    .option('-f, --format <format>', 'Output format: markdown, json, opml', 'markdown')
    .option('-d, --depth <depth>', 'Maximum depth to export')
    .action(async (target, options) => {
        try {
            const session = await createSession();

            const cmdDef = getCommand('export')!;
            const args: string[] = [];
            if (target) args.push(target);
            if (options.format) args.push('--format', options.format);
            if (options.depth) args.push('--depth', options.depth);

            const ctx = parseArgs(cmdDef, args);
            await cmdDef.handler(session, ctx);
        } catch (e: any) {
            console.error(`Error: ${e.message}`);
            process.exit(1);
        }
    });

program
    .command('import')
    .description('Import nodes from stdin (use: cat file.json | wf import)')
    .option('-f, --format <format>', 'Input format: json, markdown (auto-detect if omitted)')
    .option('-p, --path <path>', 'Parent path to import into')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
        try {
            const session = await createSession();

            const cmdDef = getCommand('import')!;
            const args: string[] = [];
            if (options.format) args.push('--format', options.format);
            if (options.path) args.push('--path', options.path);
            if (options.json) args.push('--json');

            const ctx = parseArgs(cmdDef, args);
            await cmdDef.handler(session, ctx);
        } catch (e: any) {
            if (options.json) {
                console.log(JSON.stringify({ error: e.message }));
            } else {
                console.error(`Error: ${e.message}`);
            }
            process.exit(1);
        }
    });

// --- MCP Server Mode ---

program
    .command('mcp')
    .description('Start MCP server for AI agents (stdio transport)')
    .action(async () => {
        const { startMcpServer } = await import('./mcp/server.js');
        await startMcpServer();
    });

// --- Interactive REPL (default) ---

program
    .command('repl [initialPath]', { isDefault: true })
    .description('Start interactive shell')
    .action(async (initialPath) => {
        const client = createClient();

        // Skip API key check in mock mode
        if (!isMockMode() && !client.getApiKey()) {
            console.error("Please login first: wf login <key>");
            process.exit(1);
        }

        const session = new Session(client);
        const spinnerText = isMockMode()
            ? 'Starting in mock mode...'
            : 'Connecting to Workflowy...';
        const spinner = ora(spinnerText).start();

        try {
            await session.init();

            if (initialPath) {
                try {
                    spinner.text = `Navigating to ${initialPath}...`;
                    await session.changeDirectory(initialPath);
                    spinner.succeed(isMockMode()
                        ? `Mock mode active (${initialPath})`
                        : `Connected (${initialPath})`);
                } catch (navError: any) {
                    spinner.warn(`Could not navigate to '${initialPath}': ${navError.message}`);
                    spinner.succeed(isMockMode() ? "Mock mode active" : "Connected");
                }
            } else {
                spinner.succeed(isMockMode() ? "Mock mode active" : "Connected");
            }

            await startRepl(session);
        } catch (e: any) {
            spinner.fail("Failed to start session");
            console.error(e.message);
        }
    });

program.parse();



