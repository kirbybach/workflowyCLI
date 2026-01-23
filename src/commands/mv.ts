import { Session } from '../state/session.js';
import chalk from 'chalk';

export async function mv(session: Session, args: string[]) {
    // Usage: mv <source> <destination_id_or_path?>
    // The user request just said "mv". 
    // Standard shell mv: mv file destination_dir
    // For Workflowy: mv <item> <new_parent>

    if (args.length < 2) {
        console.log(chalk.red("Usage: mv <source> <destination_parent_id_or_index>"));
        return;
    }

    const sourceArg = args[0];
    const destArg = args[1];

    try {
        // Resolve source node relative to current directory
        const sourceNode = await session.resolveChild(sourceArg!);
        if (!sourceNode) {
            console.log(chalk.red(`Source node not found: ${sourceArg}`));
            return;
        }

        // Resolve destination. Destination must be a PARENT node (folder).
        // Since we don't have full path resolution yet (like mv file ../folder/),
        // we might only support moving to a sibling (reorder?) or to a known ID?
        // Let's assume destArg is an index in the current list (making it a child of current?)
        // OR destArg is ".." (move to parent). 

        let destId: string | undefined;

        if (destArg === "..") {
            // Move to parent of current view.
            // We need to know who the parent of current view is.
            // `session.currentPath` keeps track.
            // currentPath = [Root, Parent, Current]
            // parentId of Current is Parent.
            // But we want to move `sourceNode` (child of Current) to `Parent` (parent of Current).
            // Wait, `mv child ..` moves child to parent directory.

            // We need session to expose the parent ID of the current view.
            // session.currentPath[...]
            // Let's assume we can get it or implement a helper.
            // For now, let's peek into session internals if feasible or implement helper `getParentId`.
            // Actually, `resolveChild` finds valid children. `..` is not a child.
            // I will hack a check here.

            // BUT wait, session.ts doesn't expose parent path access easily publicly.
            // I should probably support "move to index" (reorder) or "move to ID".
            // Given limitations, let's try to resolve destArg as a child of current view first (move into folder).

            const destNode = await session.resolveChild(destArg!);
            if (destNode) {
                destId = destNode.id;
            }
        }

        if (!destId && destArg!.length > 30) {
            // Assume UUID?
            destId = destArg;
        }

        if (!destId) {
            console.log(chalk.red(`Destination not found or not supported yet (try a child folder or UUID).`));
            return;
        }

        // Priority? List at bottom (default)?
        // 0 usually top. 
        // We'll put it at the top or bottom. 
        // API: "priority" number. 
        // Let's assume 0 for now.
        await session.moveNode(sourceNode.id, destId, 0);
        console.log(chalk.green(`Moved ${sourceNode.name} to ${destId}`));

    } catch (e: any) {
        console.error(chalk.red("Error moving node:"), e.message);
    }
}
