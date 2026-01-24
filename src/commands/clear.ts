import { registerCommand } from './registry.js';

registerCommand({
    name: 'clear',
    description: 'Clear the terminal screen',
    usage: 'clear',
    handler: async () => {
        console.clear();
    }
});
