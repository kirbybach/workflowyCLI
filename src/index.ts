#!/usr/bin/env node
import { Command } from 'commander';
import ora from 'ora';
import { createClient, isMockMode } from './api/index.js';
import { WorkflowyClient } from './api/client.js';
import { Session } from './state/session.js';
import { startRepl } from './cli/repl.js';

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

program
    .command('repl', { isDefault: true })
    .description('Start interactive shell')
    .action(async () => {
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
            spinner.succeed(isMockMode() ? "Mock mode active" : "Connected");
            await startRepl(session);
        } catch (e: any) {
            spinner.fail("Failed to start session");
            console.error(e.message);
        }
    });

program.parse();


