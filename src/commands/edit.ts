import { Session } from '../state/session.js';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

export async function edit(session: Session, args: string[]) {
    if (args.length === 0) {
        console.log(chalk.red("Usage: edit <target> [new_text]"));
        return;
    }

    try {
        const target = await session.resolveChild(args[0]!);
        if (!target) {
            console.log(chalk.red(`Node not found: ${args[0]}`));
            return;
        }

        if (args.length > 1) {
            const newName = args.slice(1).join(" ");
            await session.updateNode(target.id, { name: newName });
            console.log(chalk.green(`Renamed to: ${newName}`));
        } else {
            const editor = process.env.EDITOR || 'vim';
            const tmpDir = os.tmpdir();
            const tmpFile = path.join(tmpDir, `workflowy_edit_${target.id}.md`);

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

                            // Trim for comparison and storage
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
        console.error(chalk.red("Error editing node:"), e.message);
    }
}
