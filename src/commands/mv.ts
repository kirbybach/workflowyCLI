import { Session } from '../state/session.js';
import chalk from 'chalk';

export async function mv(session: Session, args: string[]) {
    // Usage: mv <source> <destination>
    // Supports: mv <item> .. (move to parent), mv <item> <folder> (move into folder)

    if (args.length < 2) {
        console.log(chalk.red("Usage: mv <source> <destination>"));
        return;
    }

    const sourceArg = args[0]!;
    const destArg = args[1]!;

    try {
        // Resolve source node relative to current directory
        const sourceNode = await session.resolveChild(sourceArg);
        if (!sourceNode) {
            console.log(chalk.red(`Source node not found: ${sourceArg}`));
            return;
        }

        let destId: string | undefined;
        let destName: string = destArg;

        if (destArg === "..") {
            // Move to parent of current view
            const parentId = session.getParentNodeId();
            if (!parentId) {
                console.log(chalk.red("Already at root, cannot move to parent."));
                return;
            }
            destId = parentId;
            destName = "parent directory";
        } else {
            // Try to resolve as a child folder
            const destNode = await session.resolveChild(destArg);
            if (destNode) {
                destId = destNode.id;
                destName = destNode.name;
            } else if (destArg.length > 30) {
                // Assume UUID if it's long enough
                destId = destArg;
            }
        }

        if (!destId) {
            console.log(chalk.red(`Destination not found: ${destArg}`));
            return;
        }

        // Priority 0 = top of the list
        await session.moveNode(sourceNode.id, destId, 0);
        console.log(chalk.green(`Moved "${sourceNode.name}" to ${destName}`));

    } catch (e: any) {
        console.error(chalk.red("Error moving node:"), e.message);
    }
}

