import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import chalk from 'chalk';
import boxen from 'boxen';
import { Session } from '../state/session.js';
import * as commands from '../commands/index.js';

export async function startRepl(session: Session) {
    const rl = readline.createInterface({
        input,
        output,
        terminal: true,
        completer: (async (line: string) => {
            try {
                return await getSuggestionsAsync(session, line);
            } catch (e) {
                return [[], line] as [string[], string];
            }
        }) as any
    });

    rl.on('SIGINT', () => {
        // Clear current line using process.stdout directly
        output.clearLine(0);
        output.cursorTo(0);
        console.log('^C');
    });

    console.log(boxen(chalk.blue("Workflowy CLI"), { padding: 1, borderStyle: 'round', borderColor: 'blue' }));
    console.log(chalk.dim("Type 'help' for commands."));

    while (true) {
        const pathStr = session.getCurrentPathString();
        const prompt = `workflowy:${chalk.blue(pathStr)} $ `;

        let answer;
        try {
            answer = await rl.question(prompt);
        } catch (e) {
            break;
        }

        const line = answer.trim();
        if (!line) continue;

        if (line === 'exit' || line === 'quit') {
            break;
        }

        const [cmd, ...args] = parseArgs(line);

        try {
            switch (cmd) {
                case 'ls':
                    await commands.ls(session, args);
                    break;
                case 'cd':
                    await commands.cd(session, args);
                    break;
                case 'add':
                    await commands.add(session, args);
                    break;
                case 'rm':
                    await commands.rm(session, args);
                    break;
                case 'mv':
                    await commands.mv(session, args);
                    break;
                case 'tree':
                    await commands.tree(session, args);
                    break;
                case 'edit':
                    rl.pause();
                    try {
                        await commands.edit(session, args);
                    } finally {
                        rl.resume();
                    }
                    break;
                case 'complete':
                    await commands.complete(session, args);
                    break;
                case 'refresh':
                    await commands.refresh(session);
                    break;
                case 'copy':
                    await commands.copy(session, args);
                    break;
                case 'clear':
                    console.clear();
                    break;
                case 'help':
                    console.log(`
Available commands:
  ls [-a]           List items (hide completed by default, use -a to show all)
  cd <dir>          Change directory (supports .., ~, /)
  tree [-a] [n]     Show tree structure (n = depth)
  add <name> [note] Create item with optional note
  rm [-f] <item>    Delete item (-f to skip confirmation)
  mv <src> <dst>    Move item (dst can be .., folder, or UUID)
  copy [n]          Copy item n (or all) to clipboard
  edit <item> [txt] Edit item (opens $EDITOR if no text provided)
  complete <item>   Toggle completion status
  refresh           Refresh current view
  clear             Clear screen
  exit              Exit
                    `);
                    break;
                default:
                    console.log(chalk.red(`Unknown command: ${cmd}`));
            }
        } catch (e: any) {
            console.error(chalk.red("Error:"), e.message);
        }
    }

    rl.close();
}

function parseArgs(str: string): string[] {
    const args: string[] = [];
    let current = '';
    let inQuote = false;

    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if (char === '"') {
            inQuote = !inQuote;
        } else if (char === ' ' && !inQuote) {
            if (current) args.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    if (current) args.push(current);

    return args;
}

async function getSuggestionsAsync(session: Session, line: string): Promise<[string[], string]> {
    // 1. Parse line to find the current argument being typed
    let inQuote = false;
    let currentArgStart = 0;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuote = !inQuote;
        } else if (char === ' ' && !inQuote) {
            currentArgStart = i + 1;
        }
    }

    const currentArg = line.slice(currentArgStart);
    // Determine if we are completing the command (first word)
    // If currentArgStart is 0, we are definitely on the first word.
    const isCommand = currentArgStart === 0;

    if (isCommand) {
        const cmds = ['ls', 'cd', 'add', 'rm', 'mv', 'copy', 'edit', 'complete', 'refresh', 'clear', 'help', 'tree', 'exit'];
        const matches = cmds.filter(c => c.startsWith(currentArg));
        return [matches, currentArg];
    }

    // Otherwise assume node completion
    try {
        const children = await session.getChildren(); // Async fetch!
        if (!children) return [[], currentArg];

        const names = children.map((c: any) => c.name);

        let searchStr = currentArg;
        let isQuoted = false;

        if (currentArg.startsWith('"')) {
            isQuoted = true;
            searchStr = currentArg.slice(1);
        }

        const matches = names.filter((n: string) => n.startsWith(searchStr));

        // Re-format matches. If it needs quotes (has space) or was already quoted, wrap in quotes.
        const finalMatches = matches.map((n: string) => {
            if (n.includes(' ') || isQuoted) {
                return `"${n}"`;
            }
            return n;
        });

        return [finalMatches, currentArg];
    } catch (e) {
        return [[], currentArg];
    }
}
