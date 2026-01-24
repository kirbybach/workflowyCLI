import chalk from 'chalk';
import { Session } from '../state/session.js';
import { registerCommand } from './registry.js';
import type { CommandContext } from './registry.js';
import type { WorkflowyNode } from '../api/index.js';

// Register the export command
registerCommand({
    name: 'export',
    description: 'Export node tree to various formats',
    usage: 'export [target] --format=markdown|json|opml [-d depth]',
    args: [
        { name: 'target', required: false, description: 'Node to export (default: current)' }
    ],
    flags: [
        { name: 'format', alias: 'f', description: 'Output format: markdown, json, opml', type: 'string' },
        { name: 'depth', alias: 'd', description: 'Maximum depth to export', type: 'string' }
    ],
    handler: exportHandler
});

async function exportHandler(session: Session, { args, flags }: CommandContext): Promise<void> {
    const format = (flags.format as string) || 'markdown';
    const maxDepth = flags.depth ? parseInt(flags.depth as string, 10) : Infinity;

    try {
        // Resolve target node
        let targetId = session.getCurrentNodeId();
        let targetName = session.getCurrentPath();

        if (args[0]) {
            const target = await session.resolveChild(args[0]);
            if (!target) {
                throw new Error(`Not found: ${args[0]}`);
            }
            targetId = target.id;
            targetName = target.name;
        }

        // Fetch the tree
        const children = await session.getChildren(targetId);
        const tree = await buildFullTree(session, children, 0, maxDepth);

        // Export based on format
        switch (format.toLowerCase()) {
            case 'json':
                console.log(JSON.stringify({
                    name: targetName,
                    exported: new Date().toISOString(),
                    children: tree
                }, null, 2));
                break;

            case 'opml':
                console.log(toOpml(targetName, tree));
                break;

            case 'markdown':
            case 'md':
            default:
                console.log(toMarkdown(tree, 0));
                break;
        }

    } catch (e: any) {
        if (flags.json) {
            console.log(JSON.stringify({ error: e.message }, null, 2));
            process.exitCode = 1;
        } else {
            console.error(chalk.red('Error exporting:'), e.message);
        }
    }
}

interface ExportNode {
    id: string;
    name: string;
    note: string | null;
    completed: boolean;
    children: ExportNode[];
}

async function buildFullTree(
    session: Session,
    nodes: WorkflowyNode[],
    currentDepth: number,
    maxDepth: number
): Promise<ExportNode[]> {
    const result: ExportNode[] = [];

    for (const node of nodes) {
        const exportNode: ExportNode = {
            id: node.id,
            name: node.name || '',
            note: node.note || null,
            completed: !!node.completedAt,
            children: []
        };

        if (currentDepth < maxDepth) {
            try {
                const children = await session.getChildren(node.id);
                exportNode.children = await buildFullTree(session, children, currentDepth + 1, maxDepth);
            } catch {
                // Ignore errors fetching children
            }
        }

        result.push(exportNode);
    }

    return result;
}

function toMarkdown(nodes: ExportNode[], depth: number): string {
    let output = '';
    const indent = '  '.repeat(depth);

    for (const node of nodes) {
        const prefix = node.completed ? '- [x]' : '-';
        output += `${indent}${prefix} ${node.name}\n`;

        if (node.note) {
            // Notes as indented sub-lines
            const noteLines = node.note.split('\n');
            for (const line of noteLines) {
                output += `${indent}  > ${line}\n`;
            }
        }

        if (node.children.length > 0) {
            output += toMarkdown(node.children, depth + 1);
        }
    }

    return output;
}

function toOpml(title: string, nodes: ExportNode[]): string {
    const escapeXml = (str: string): string => {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    };

    const buildOutline = (nodes: ExportNode[], indent: string): string => {
        let output = '';
        for (const node of nodes) {
            const attrs = [`text="${escapeXml(node.name)}"`];
            if (node.note) {
                attrs.push(`_note="${escapeXml(node.note)}"`);
            }
            if (node.completed) {
                attrs.push('_complete="true"');
            }

            if (node.children.length > 0) {
                output += `${indent}<outline ${attrs.join(' ')}>\n`;
                output += buildOutline(node.children, indent + '  ');
                output += `${indent}</outline>\n`;
            } else {
                output += `${indent}<outline ${attrs.join(' ')} />\n`;
            }
        }
        return output;
    };

    return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>${escapeXml(title)}</title>
    <dateCreated>${new Date().toISOString()}</dateCreated>
  </head>
  <body>
${buildOutline(nodes, '    ')}  </body>
</opml>`;
}

// Legacy export for backward compatibility
export async function exportCmd(session: Session, args: string[]) {
    const { parseArgs, getCommand } = await import('./registry.js');
    const def = getCommand('export')!;
    const ctx = parseArgs(def, args);
    await exportHandler(session, ctx);
}
