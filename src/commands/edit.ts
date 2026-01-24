import { Session } from '../state/session.js';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { registerCommand } from './registry.js';
import type { CommandContext } from './registry.js';

registerCommand({
    name: 'edit',
    description: 'Edit a node\'s name or note',
    usage: 'edit <target> [new_text] [--json]',
    args: [
        { name: 'target', required: true, description: 'Node to edit (name, index, or ID)' },
        { name: 'new_text', required: false, description: 'New name (if provided, skips editor)' }
    ],
    flags: [
        { name: 'json', description: 'Output as JSON', type: 'boolean' }
    ],
    handler: editHandler
});

async function editHandler(session: Session, { args, flags }: CommandContext) {
    try {
        // args[0] is target, args[1...] is new text
        const targetArg = args[0]!;
        const target = await session.resolvePath(targetArg); // Moved to resolvePath

        if (!target) {
            throw new Error(`Node not found: ${targetArg}`);
        }

        if (args.length > 1) {
            // Quick rename without editor
            const newName = args.slice(1).join(" ");
            await session.updateNode(target.id, { name: newName });

            if (flags.json) {
                console.log(JSON.stringify({
                    success: true,
                    id: target.id,
                    oldName: target.name,
                    newName
                }, null, 2));
            } else {
                console.log(chalk.green(`Renamed to: ${newName}`));
            }
        } else {
            // Interactive Editor
            if (flags.json) {
                // Interactive mode not supported with --json usually, unless we just print info?
                // Or maybe we treat it as "fetching content for edit"?
                // Standard behavior: json flag implies automation, so invoking interactive editor implies failure or bad usage?
                // But for now, let's allow it but fail if not TTY?
                throw new Error("Cannot use interactive editor with --json flag. Provide new_text argument.");
            }

            const editor = process.env.EDITOR || 'vim';
            const tmpDir = os.tmpdir();
            const tmpFile = path.join(tmpDir, `workflowy_edit_${target.id}.md`);

            // Use simplified content structure
            const initialContent = `${target.name}\n${target.note || ''}`;
            await fs.writeFile(tmpFile, initialContent);

            await new Promise<void>((resolve, reject) => {
                const wasRaw = process.stdin.isRaw;
                if (wasRaw && process.stdin.setRawMode) {
                    process.stdin.setRawMode(false);
                }

                const child = spawn(editor, [tmpFile], {
                    stdio: 'inherit'
                });

                child.on('error', (err) => {
                    if (wasRaw && process.stdin.setRawMode) {
                        process.stdin.setRawMode(true);
                    }
                    reject(err);
                });

                child.on('exit', async (code) => {
                    if (wasRaw && process.stdin.setRawMode) {
                        process.stdin.setRawMode(true);
                        process.stdin.resume();
                    }

                    try {
                        if (code === 0) {
                            const content = await fs.readFile(tmpFile, 'utf-8');
                            const lines = content.split('\n');
                            const rawName = lines[0] || "";
                            const rawNote = lines.slice(1).join('\n');

                            const newName = rawName.trim();
                            const newNote = rawNote.trim();
                            const oldNote = (target.note || '').trim();

                            if (!newName) {
                                console.log(chalk.red("Name cannot be empty."));
                            } else if (newName !== target.name || newNote !== oldNote) {
                                await session.updateNode(target.id, { name: newName, note: newNote });
                                console.log(chalk.green("Updated node."));
                            } else {
                                console.log(chalk.gray("No changes detected."));
                            }
                        } else {
                            console.log(chalk.red("Editor exited with error."));
                        }
                    } catch (err) {
                        reject(err);
                        return;
                    } finally {
                        await fs.unlink(tmpFile).catch(() => { });
                    }
                    resolve();
                });
            });
        }
    } catch (e: any) {
        if (flags.json) {
            console.log(JSON.stringify({ error: e.message }));
        } else {
            console.error(chalk.red("Error editing node:"), e.message);
        }
    }
}

