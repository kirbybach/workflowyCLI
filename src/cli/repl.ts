import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import chalk from 'chalk';
import boxen from 'boxen';
import { Session } from '../state/session.js';
import Conf from 'conf';

import { getCommand, parseArgs as registryParseArgs, generateHelpAll, generateHelp } from '../commands/registry.js';

const config = new Conf({
    projectName: 'workflowycli-history',
    clearInvalidConfig: true
});

export async function startRepl(session: Session) {
    const history = config.get('history', []) as string[];

    const rl = readline.createInterface({
        input,
        output,
        terminal: true,
        historySize: 100,
        completer: (async (line: string) => {
            try {
                return await getSuggestionsAsync(session, line);
            } catch (e) {
                return [[], line] as [string[], string];
            }
        }) as any
    });

    // Load history
    (rl as any).history = history;

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
            config.set('history', (rl as any).history);
            break;
        }

        const [cmd, ...args] = parseArgs(line);

        try {
            // Check if command is in registry
            const cmdDef = getCommand(cmd!);
            if (cmdDef) {
                rl.pause();
                try {
                    const ctx = registryParseArgs(cmdDef, args);
                    await cmdDef.handler(session, ctx);
                } finally {
                    rl.resume();
                }
            } else {
                console.log(chalk.red(`Unknown command: ${cmd}`));
            }
        } catch (e: any) {
            console.error(chalk.red("Error:"), e.message);
        }
    }

    config.set('history', (rl as any).history);
    rl.close();
}

function parseArgs(str: string): string[] {
    const args: string[] = [];
    let current = '';
    let quoteChar: string | null = null;
    let escaped = false;

    for (let i = 0; i < str.length; i++) {
        const char = str[i];

        if (escaped) {
            current += char;
            escaped = false;
        } else if (char === '\\') {
            escaped = true;
        } else if ((char === '"' || char === "'") && (quoteChar === null || quoteChar === char)) {
            quoteChar = quoteChar === null ? char : null;
        } else if (char === ' ' && quoteChar === null) {
            if (current) {
                args.push(current);
                current = '';
            }
        } else {
            current += char;
        }
    }

    // Trailing escape check (just append literal backslash if string ends with one, though usually invalid syntax)
    if (escaped) current += '\\';

    if (current) args.push(current);

    return args;
}

async function getSuggestionsAsync(session: Session, line: string): Promise<[string[], string]> {
    // 1. Parse line to find the current argument being typed
    let quoteChar: string | null = null;
    let currentArgStart = 0;
    let escaped = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (escaped) {
            escaped = false;
        } else if (char === '\\') {
            escaped = true;
        } else if ((char === '"' || char === "'") && (quoteChar === null || quoteChar === char)) {
            quoteChar = quoteChar === null ? char : null;
        } else if (char === ' ' && quoteChar === null) {
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
        let usedQuote: string | null = null;

        if (currentArg.startsWith('"')) {
            usedQuote = '"';
            searchStr = currentArg.slice(1);
        } else if (currentArg.startsWith("'")) {
            usedQuote = "'";
            searchStr = currentArg.slice(1);
        }

        // Handle escaped quotes in searchStr if they exist? 
        // For simplicity, strict prefix match on raw name is tricky if user typed escaped version.
        // We'll trust the user typed a literal prefix of the name unless they used quotes.
        // If they used quotes, we really should unescape the searchStr.
        if (usedQuote) {
            searchStr = searchStr.replace(/\\(.)/g, '$1');
        }

        const matches = names.filter((n: string) => n.startsWith(searchStr));

        // Re-format matches. If it needs quotes (has space) or was already quoted, wrap in quotes.
        // Use the same quote character that was started, or default to double quotes.
        const finalMatches = matches.map((n: string) => {
            if (n.includes(' ') || usedQuote || n.includes('"') || n.includes("'")) {
                const q = usedQuote || '"';
                // Escape internal occurrences of the quote char
                const escapedN = n.replaceAll(q, `\\${q}`);
                return `${q}${escapedN}${q}`;
            }
            return n;
        });

        return [finalMatches, currentArg];
    } catch (e) {
        return [[], currentArg];
    }
}
