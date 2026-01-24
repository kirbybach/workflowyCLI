import { Session } from '../state/session.js';
import chalk from 'chalk';
import { registerCommand, getCommand, generateHelp, generateHelpAll } from './registry.js';
import type { CommandContext } from './registry.js';

registerCommand({
    name: 'help',
    description: 'Show available commands',
    usage: 'help [command]',
    args: [
        { name: 'command', required: false, description: 'Command to get help for' }
    ],
    handler: helpHandler
});

async function helpHandler(session: Session, { args }: CommandContext) {
    if (args.length > 0) {
        const cmdName = args[0]!;
        const cmd = getCommand(cmdName);
        if (cmd) {
            console.log(generateHelp(cmd));
        } else {
            console.error(chalk.red(`Unknown command: ${cmdName}`));
        }
    } else {
        console.log(generateHelpAll());
    }
}
