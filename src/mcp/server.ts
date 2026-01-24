/**
 * MCP Server for WorkflowyCLI
 * 
 * Exposes Workflowy operations as MCP tools for AI agents.
 * Run with: wf mcp
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { createClient, isMockMode } from '../api/index.js';
import { Session } from '../state/session.js';

// Import command handlers
import { getCommand, parseArgs } from '../commands/registry.js';

// Register all commands
import '../commands/ls.js';
import '../commands/tree.js';
import '../commands/add.js';
import '../commands/rm.js';
import '../commands/complete.js';
import '../commands/find.js';
import '../commands/sync.js';
import '../commands/export.js';

let session: Session | null = null;

async function getSession(): Promise<Session> {
    if (!session) {
        const client = createClient();
        if (!isMockMode() && !client.getApiKey()) {
            throw new Error('Not logged in. Run `wf login <key>` first.');
        }
        session = new Session(client);
        await session.init();
    }
    return session;
}

// Helper to capture command output
async function captureOutput<T>(fn: () => Promise<T>): Promise<{ output: string; error?: string }> {
    const originalLog = console.log;
    const originalError = console.error;
    let output = '';
    let error = '';

    console.log = (...args) => {
        output += args.map(a => typeof a === 'string' ? a : JSON.stringify(a, null, 2)).join(' ') + '\n';
    };
    console.error = (...args) => {
        error += args.map(a => typeof a === 'string' ? a : JSON.stringify(a, null, 2)).join(' ') + '\n';
    };

    try {
        await fn();
        return { output: output.trim() };
    } finally {
        console.log = originalLog;
        console.error = originalError;
    }
}

export async function startMcpServer(): Promise<void> {
    const server = new McpServer({
        name: 'workflowy',
        version: '1.0.0'
    });

    // Tool: wf_ls - List children at path
    server.tool(
        'wf_ls',
        'List children of a Workflowy node',
        {
            path: z.string().optional().describe('Path to list (e.g., "/Projects" or "1")'),
            all: z.boolean().optional().describe('Include completed items')
        },
        async ({ path, all }) => {
            const sess = await getSession();
            if (path) await sess.changeDirectory(path);

            const cmdDef = getCommand('ls')!;
            const args = ['--json'];
            if (all) args.push('-a');

            const { output, error } = await captureOutput(async () => {
                const ctx = parseArgs(cmdDef, args);
                await cmdDef.handler(sess, ctx);
            });

            return {
                content: [{ type: 'text', text: output || error || 'No output' }]
            };
        }
    );

    // Tool: wf_tree - Get tree structure
    server.tool(
        'wf_tree',
        'Show tree structure of a Workflowy node',
        {
            path: z.string().optional().describe('Path to show tree for'),
            depth: z.number().optional().describe('Maximum depth (default: 2)')
        },
        async ({ path, depth }) => {
            const sess = await getSession();
            if (path) await sess.changeDirectory(path);

            const cmdDef = getCommand('tree')!;
            const args = ['--json'];
            if (depth) args.push(String(depth));

            const { output, error } = await captureOutput(async () => {
                const ctx = parseArgs(cmdDef, args);
                await cmdDef.handler(sess, ctx);
            });

            return {
                content: [{ type: 'text', text: output || error || 'No output' }]
            };
        }
    );

    // Tool: wf_add - Create a new node
    server.tool(
        'wf_add',
        'Create a new Workflowy node',
        {
            name: z.string().describe('Name of the node to create'),
            note: z.string().optional().describe('Optional note for the node'),
            path: z.string().optional().describe('Path to create node in')
        },
        async ({ name, note, path }) => {
            const sess = await getSession();
            if (path) await sess.changeDirectory(path);

            const cmdDef = getCommand('add')!;
            const args = [name, '--json'];
            if (note) args.splice(1, 0, note);

            const { output, error } = await captureOutput(async () => {
                const ctx = parseArgs(cmdDef, args);
                await cmdDef.handler(sess, ctx);
            });

            return {
                content: [{ type: 'text', text: output || error || 'No output' }]
            };
        }
    );

    // Tool: wf_rm - Delete a node
    server.tool(
        'wf_rm',
        'Delete a Workflowy node',
        {
            target: z.string().describe('Node to delete (index or name)'),
            path: z.string().optional().describe('Path containing the node')
        },
        async ({ target, path }) => {
            const sess = await getSession();
            if (path) await sess.changeDirectory(path);

            const cmdDef = getCommand('rm')!;
            const args = [target, '--force', '--json'];

            const { output, error } = await captureOutput(async () => {
                const ctx = parseArgs(cmdDef, args);
                await cmdDef.handler(sess, ctx);
            });

            return {
                content: [{ type: 'text', text: output || error || 'No output' }]
            };
        }
    );

    // Tool: wf_complete - Toggle completion status
    server.tool(
        'wf_complete',
        'Toggle completion status of a Workflowy node',
        {
            target: z.string().describe('Node to complete/uncomplete (index or name)'),
            path: z.string().optional().describe('Path containing the node')
        },
        async ({ target, path }) => {
            const sess = await getSession();
            if (path) await sess.changeDirectory(path);

            const cmdDef = getCommand('complete')!;
            const args = [target, '--json'];

            const { output, error } = await captureOutput(async () => {
                const ctx = parseArgs(cmdDef, args);
                await cmdDef.handler(sess, ctx);
            });

            return {
                content: [{ type: 'text', text: output || error || 'No output' }]
            };
        }
    );

    // Tool: wf_find - Search nodes
    server.tool(
        'wf_find',
        'Search for Workflowy nodes',
        {
            query: z.string().describe('Search query'),
            includeNotes: z.boolean().optional().describe('Search in notes too'),
            limit: z.number().optional().describe('Maximum results to return')
        },
        async ({ query, includeNotes, limit }) => {
            const sess = await getSession();

            const cmdDef = getCommand('find')!;
            const args = [query, '--json'];
            if (includeNotes) args.push('--notes');
            if (limit) args.push('--limit', String(limit));

            const { output, error } = await captureOutput(async () => {
                const ctx = parseArgs(cmdDef, args);
                await cmdDef.handler(sess, ctx);
            });

            return {
                content: [{ type: 'text', text: output || error || 'No output' }]
            };
        }
    );

    // Tool: wf_export - Export subtree
    server.tool(
        'wf_export',
        'Export Workflowy subtree to JSON or markdown',
        {
            path: z.string().optional().describe('Path to export'),
            format: z.enum(['json', 'markdown', 'opml']).optional().describe('Export format')
        },
        async ({ path, format }) => {
            const sess = await getSession();

            const cmdDef = getCommand('export')!;
            const args: string[] = [];
            if (path) args.push(path);
            args.push('--format', format || 'json');

            const { output, error } = await captureOutput(async () => {
                const ctx = parseArgs(cmdDef, args);
                await cmdDef.handler(sess, ctx);
            });

            return {
                content: [{ type: 'text', text: output || error || 'No output' }]
            };
        }
    );

    // Start the server
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
