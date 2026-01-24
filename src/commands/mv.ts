import { Session } from '../state/session.js';
import chalk from 'chalk';
import { registerCommand } from './registry.js';
import type { CommandContext } from './registry.js';

registerCommand({
    name: 'mv',
    description: 'Move a node to a new parent',
    usage: 'mv <source> <destination> [--json]',
    args: [
        { name: 'source', required: true, description: 'Node to move' },
        { name: 'destination', required: true, description: 'New parent folder' }
    ],
    flags: [
        { name: 'json', description: 'Output as JSON', type: 'boolean' }
    ],
    handler: mvHandler
});

async function mvHandler(session: Session, { args, flags }: CommandContext) {
    const sourceArg = args[0]!;
    const destArg = args[1]!;

    try {
        const sourceNode = await session.resolvePath(sourceArg);
        if (!sourceNode) {
            throw new Error(`Source node not found: ${sourceArg}`);
        }

        let destId: string | undefined;
        let destName: string = destArg;

        if (destArg === "..") {
            const parentId = session.getParentNodeId();
            if (!parentId) {
                throw new Error("Already at root, cannot move to parent.");
            }
            destId = parentId;
            destName = "parent directory";
        } else {
            const destNode = await session.resolvePath(destArg);
            if (destNode) {
                destId = destNode.id;
                destName = destNode.name;
            } else if (destArg.length > 30) {
                // Assume UUID
                destId = destArg;
            }
        }

        if (!destId) {
            throw new Error(`Destination not found: ${destArg}`);
        }

        await session.moveNode(sourceNode.id, destId, 0);

        if (flags.json) {
            console.log(JSON.stringify({
                success: true,
                source: { id: sourceNode.id, name: sourceNode.name },
                destination: { id: destId, name: destName }
            }, null, 2));
        } else {
            console.log(chalk.green(`Moved "${sourceNode.name}" to ${destName}`));
        }
    } catch (e: any) {
        if (flags.json) {
            console.log(JSON.stringify({ error: e.message }));
        } else {
            console.error(chalk.red("Error moving node:"), e.message);
        }
    }
}


