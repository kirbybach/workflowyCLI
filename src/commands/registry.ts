/**
 * Command Registry
 * 
 * Provides a centralized way to define commands with:
 * - Consistent flag parsing (--json, --force, -f, etc.)
 * - Auto-generated help text
 * - Type-safe argument handling
 */

import { Session } from '../state/session.js';

export interface CommandFlag {
    name: string;
    alias?: string;
    description: string;
    type: 'boolean' | 'string';
    default?: boolean | string;
}

export interface CommandArg {
    name: string;
    required: boolean;
    description: string;
}

export interface CommandDefinition {
    name: string;
    aliases?: string[];
    description: string;
    usage: string;
    args?: CommandArg[];
    flags?: CommandFlag[];
    handler: (session: Session, ctx: CommandContext) => Promise<void>;
}

export interface CommandContext {
    args: string[];           // Positional arguments
    flags: ParsedFlags;       // Parsed flags
    raw: string[];            // Original raw args
}

export interface ParsedFlags {
    json: boolean;            // Always available
    force: boolean;           // Always available  
    all: boolean;             // Always available (-a for ls)
    [key: string]: boolean | string;
}

// Global registry
const commands = new Map<string, CommandDefinition>();

/**
 * Register a command definition
 */
export function registerCommand(def: CommandDefinition): void {
    // Add universal flags to all commands
    const universalFlags: CommandFlag[] = [
        { name: 'json', description: 'Output as JSON', type: 'boolean' },
        { name: 'force', alias: 'f', description: 'Skip confirmations', type: 'boolean' },
    ];

    def.flags = [...universalFlags, ...(def.flags || [])];

    commands.set(def.name, def);
    def.aliases?.forEach(alias => commands.set(alias, def));
}

/**
 * Get a command by name or alias
 */
export function getCommand(name: string): CommandDefinition | undefined {
    return commands.get(name);
}

/**
 * Get all unique commands (deduped from aliases)
 */
export function getAllCommands(): CommandDefinition[] {
    const seen = new Set<string>();
    const result: CommandDefinition[] = [];
    for (const def of commands.values()) {
        if (!seen.has(def.name)) {
            seen.add(def.name);
            result.push(def);
        }
    }
    return result;
}

/**
 * Parse raw args into structured CommandContext
 */
export function parseArgs(def: CommandDefinition, rawArgs: string[]): CommandContext {
    const flags: ParsedFlags = { json: false, force: false, all: false };
    const args: string[] = [];

    for (let i = 0; i < rawArgs.length; i++) {
        const arg = rawArgs[i]!;

        // Long flag: --json, --force, etc.
        if (arg.startsWith('--')) {
            const flagName = arg.slice(2);
            const flagDef = def.flags?.find(f => f.name === flagName);
            if (flagDef?.type === 'string' && i + 1 < rawArgs.length) {
                flags[flagName] = rawArgs[++i]!;
            } else {
                flags[flagName] = true;
            }
        }
        // Short flag: -f, -a, etc.
        else if (arg.startsWith('-') && arg.length === 2) {
            const alias = arg.slice(1);
            const flagDef = def.flags?.find(f => f.alias === alias);
            if (flagDef) {
                if (flagDef.type === 'string' && i + 1 < rawArgs.length) {
                    flags[flagDef.name] = rawArgs[++i]!;
                } else {
                    flags[flagDef.name] = true;
                }
            } else {
                // Unknown short flag - treat as positional arg
                args.push(arg);
            }
        }
        // Positional argument
        else {
            args.push(arg);
        }
    }

    return { args, flags, raw: rawArgs };
}

/**
 * Generate help text for a command
 */
export function generateHelp(def: CommandDefinition): string {
    let help = `${def.name} - ${def.description}\n\n`;
    help += `Usage: ${def.usage}\n`;

    if (def.args?.length) {
        help += '\nArguments:\n';
        for (const arg of def.args) {
            const bracket = arg.required ? ['<', '>'] : ['[', ']'];
            help += `  ${bracket[0]}${arg.name}${bracket[1]}  ${arg.description}\n`;
        }
    }

    if (def.flags?.length) {
        help += '\nFlags:\n';
        for (const flag of def.flags) {
            const aliasStr = flag.alias ? `-${flag.alias}, ` : '    ';
            help += `  ${aliasStr}--${flag.name.padEnd(12)} ${flag.description}\n`;
        }
    }

    return help;
}

/**
 * Generate help for all commands
 */
export function generateHelpAll(): string {
    const cmds = getAllCommands();
    let help = 'Available commands:\n\n';

    for (const cmd of cmds) {
        const aliasStr = cmd.aliases?.length ? ` (${cmd.aliases.join(', ')})` : '';
        help += `  ${cmd.name.padEnd(12)}${aliasStr.padEnd(10)} ${cmd.description}\n`;
    }

    help += '\nType "help <command>" for more info on a specific command.';
    return help;
}

/**
 * Output helper for JSON mode
 */
export function output(data: unknown, flags: ParsedFlags): void {
    if (flags.json) {
        console.log(JSON.stringify(data, null, 2));
    }
}
