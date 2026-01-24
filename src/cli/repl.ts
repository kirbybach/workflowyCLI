import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import chalk from 'chalk';
import boxen from 'boxen';
import { Session } from '../state/session.js';

import { getCommand, parseArgs as registryParseArgs, generateHelpAll, generateHelp } from '../commands/registry.js';

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

    rl.close();
}

function parseArgs(str: string): string[] {
    const args: string[] = [];
    let current = '';
    let quoteChar: string | null = null; // Track which quote character is active

    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if ((char === '"' || char === "'") && (quoteChar === null || quoteChar === char)) {
            // Toggle quote state for matching quote type
            quoteChar = quoteChar === null ? char : null;
        } else if (char === ' ' && quoteChar === null) {
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
    let quoteChar: string | null = null;
    let currentArgStart = 0;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if ((char === '"' || char === "'") && (quoteChar === null || quoteChar === char)) {
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

        const matches = names.filter((n: string) => n.startsWith(searchStr));

        // Re-format matches. If it needs quotes (has space) or was already quoted, wrap in quotes.
        // Use the same quote character that was started, or default to double quotes.
        const finalMatches = matches.map((n: string) => {
            if (n.includes(' ') || usedQuote) {
                const q = usedQuote || '"';
                return `${q}${n}${q}`;
            }
            return n;
        });

        return [finalMatches, currentArg];
    } catch (e) {
        return [[], currentArg];
    }
}
