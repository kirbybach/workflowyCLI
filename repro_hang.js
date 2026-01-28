import { createClient } from './src/api/index.js';
import { Session } from './src/state/session.js';
// Mock environment
process.env.WF_MOCK = '1';
async function run() {
    console.log("Starting find...");
    const client = createClient();
    const session = new Session(client);
    // Initialize session
    await session.init();
    // Mock a stale cache scenario that triggers background sync
    // We can manually trigger a search
    console.log("Searching...");
    const results = await session.search("Projects");
    console.log(`Found ${results.length} results.`);
    console.log("Search done. Process should exit now.");
}
run();
//# sourceMappingURL=repro_hang.js.map