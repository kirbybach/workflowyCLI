import chalk from 'chalk';
import { Session } from '../state/session.js';
import { registerCommand } from './registry.js';
import type { CommandContext } from './registry.js';

// Register the import command
registerCommand({
    name: 'import',
    description: 'Import nodes from various formats',
    usage: 'import --format=json|markdown [-p path]',
    flags: [
        { name: 'format', alias: 'f', description: 'Input format: json, markdown (auto-detect if omitted)', type: 'string' },
        { name: 'path', alias: 'p', description: 'Parent path to import into', type: 'string' }
    ],
    handler: importHandler
});

interface ImportNode {
    name: string;
    note?: string;
    children?: ImportNode[];
}

async function importHandler(session: Session, { flags }: CommandContext): Promise<void> {
    try {
        // Navigate to target path if provided
        if (flags.path && typeof flags.path === 'string') {
            await session.changeDirectory(flags.path);
        }

        // Read from stdin
        const input = await readStdin();
        if (!input.trim()) {
            throw new Error('No input received. Pipe data to this command.');
        }

        // Detect format
        let format = flags.format as string;
        if (!format) {
            format = detectFormat(input);
        }

        // Parse input
        let nodes: ImportNode[];
        switch (format.toLowerCase()) {
            case 'json':
                nodes = parseJson(input);
                break;
            case 'markdown':
            case 'md':
                nodes = parseMarkdown(input);
                break;
            default:
                throw new Error(`Unknown format: ${format}. Use json or markdown.`);
        }

        // Import nodes
        const parentId = session.getCurrentNodeId();
        const imported = await importNodes(session, parentId, nodes);

        if (flags.json) {
            console.log(JSON.stringify({
                success: true,
                imported: imported,
                format: format,
                parent: session.getCurrentPath()
            }, null, 2));
        } else {
            console.log(chalk.green(`Imported ${imported} nodes from ${format}`));
        }

    } catch (e: any) {
        if (flags.json) {
            console.log(JSON.stringify({ success: false, error: e.message }, null, 2));
            process.exitCode = 1;
        } else {
            console.error(chalk.red('Error importing:'), e.message);
        }
    }
}

async function readStdin(): Promise<string> {
    // Check if we have stdin data
    if (process.stdin.isTTY) {
        return '';
    }

    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
}

function detectFormat(input: string): string {
    const trimmed = input.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        return 'json';
    }
    return 'markdown';
}

function parseJson(input: string): ImportNode[] {
    const parsed = JSON.parse(input);

    // Handle array of nodes
    if (Array.isArray(parsed)) {
        return parsed.map(normalizeNode);
    }

    // Handle single node
    if (parsed.name) {
        return [normalizeNode(parsed)];
    }

    // Handle object with children property (exported format)
    if (parsed.children && Array.isArray(parsed.children)) {
        return parsed.children.map(normalizeNode);
    }

    throw new Error('Invalid JSON format. Expected array of nodes or object with "children".');
}

function normalizeNode(node: any): ImportNode {
    return {
        name: node.name || node.text || '',
        note: node.note || undefined,
        children: node.children ? node.children.map(normalizeNode) : undefined
    };
}

function parseMarkdown(input: string): ImportNode[] {
    const lines = input.split('\n').filter(line => line.trim());
    const root: ImportNode[] = [];
    const stack: { indent: number; node: ImportNode; children: ImportNode[] }[] = [];

    for (const line of lines) {
        // Skip notes (lines starting with >)
        if (line.trim().startsWith('>')) {
            if (stack.length > 0) {
                const current = stack[stack.length - 1]!;
                const noteText = line.trim().slice(1).trim();
                if (current.node.note) {
                    current.node.note += '\n' + noteText;
                } else {
                    current.node.note = noteText;
                }
            }
            continue;
        }

        // Parse list items
        const match = line.match(/^(\s*)[-*]\s*(?:\[[ x]\]\s*)?(.+)$/);
        if (!match) continue;

        const indent = match[1]!.length;
        const text = match[2]!.trim();

        const node: ImportNode = { name: text };

        // Find parent based on indentation
        while (stack.length > 0 && stack[stack.length - 1]!.indent >= indent) {
            stack.pop();
        }

        if (stack.length === 0) {
            root.push(node);
        } else {
            const parent = stack[stack.length - 1]!;
            if (!parent.node.children) {
                parent.node.children = [];
            }
            parent.node.children.push(node);
        }

        stack.push({ indent, node, children: node.children || [] });
    }

    return root;
}

async function importNodes(session: Session, parentId: string, nodes: ImportNode[]): Promise<number> {
    let count = 0;

    for (const node of nodes) {
        const created = await session.createNode(parentId, node.name, node.note);
        count++;

        if (node.children && node.children.length > 0) {
            count += await importNodes(session, created.id, node.children);
        }
    }

    return count;
}

// Legacy export for backward compatibility
export async function importCmd(session: Session, args: string[]) {
    const { parseArgs, getCommand } = await import('./registry.js');
    const def = getCommand('import')!;
    const ctx = parseArgs(def, args);
    await importHandler(session, ctx);
}
