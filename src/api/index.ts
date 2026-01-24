/**
 * Client Factory
 * 
 * Returns either the real WorkflowyClient or MockWorkflowyClient
 * depending on the WF_MOCK environment variable.
 */

import { WorkflowyClient, type WorkflowyNode } from './client.js';
import { MockWorkflowyClient, isMockMode } from './mock-client.js';

/**
 * Interface that both real and mock clients implement
 */
export interface IWorkflowyClient {
    setApiKey(key: string): void;
    getApiKey(): string | undefined;
    getNodes(parentId?: string): Promise<WorkflowyNode[]>;
    createNode(parentId: string, name: string, note?: string): Promise<WorkflowyNode>;
    updateNode(id: string, updates: Partial<WorkflowyNode>): Promise<WorkflowyNode>;
    deleteNode(id: string): Promise<void>;
    completeNode(id: string): Promise<void>;
    uncompleteNode(id: string): Promise<void>;
    moveNode(id: string, parentId: string, priority: number): Promise<WorkflowyNode>;
}

// Singleton instances
let realClient: WorkflowyClient | null = null;
let mockClient: MockWorkflowyClient | null = null;

/**
 * Get the appropriate client based on environment
 * 
 * Usage:
 *   const client = createClient();
 *   const nodes = await client.getNodes();
 * 
 * To use mock mode, set WF_MOCK=1:
 *   WF_MOCK=1 wf ls
 */
export function createClient(): IWorkflowyClient {
    if (isMockMode()) {
        if (!mockClient) {
            mockClient = new MockWorkflowyClient();
            console.error('\x1b[33m[MOCK MODE]\x1b[0m Using mock Workflowy data');
        }
        return mockClient;
    }

    if (!realClient) {
        realClient = new WorkflowyClient();
    }
    return realClient;
}

/**
 * Reset the mock client (for testing between test cases)
 */
export function resetMockClient(): void {
    if (mockClient) {
        mockClient.reset();
    }
}

/**
 * Get the mock client directly (for test assertions)
 */
export function getMockClient(): MockWorkflowyClient | null {
    return mockClient;
}

// Re-export types for convenience
export type { WorkflowyNode } from './client.js';
export { isMockMode } from './mock-client.js';
