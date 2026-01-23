#!/usr/bin/env node
import { Command } from 'commander';
import { WorkflowyClient } from './api/client.js';
import { Session } from './state/session.js';
import { startRepl } from './cli/repl.js';

const program = new Command();

program
    .name('workflowy')
    .description('CLI for Workflowy')
    .version('1.0.0');

program
    .command('login')
    .description('Set API Key')
    .argument('<key>', 'Your Workflowy API Key')
    .action((key) => {
        const client = new WorkflowyClient();
        client.setApiKey(key);
        console.log("API Key saved.");
    });

program
    .command('repl', { isDefault: true })
    .description('Start interactive shell')
    .action(async () => {
        const client = new WorkflowyClient();
        if (!client.getApiKey()) {
            console.error("Please login first: workflowy login <key>");
            process.exit(1);
        }

        const session = new Session(client);
        try {
            await session.init();
            await startRepl(session);
        } catch (e: any) {
            console.error("Failed to start session:", e.message);
        }
    });

program.parse();
