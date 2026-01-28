/**
 * Mock Workflowy Client for testing
 * 
 * Usage: Set WF_MOCK=1 environment variable to use mock data instead of real API
 * 
 * The mock maintains an in-memory tree that behaves like the real Workflowy API,
 * allowing safe testing of all CRUD operations without affecting real data.
 */

import type { WorkflowyNode } from './client.js';

// Default mock data - a realistic tree structure for testing
const DEFAULT_MOCK_TREE: WorkflowyNode[] = [
    {
        id: 'mock-projects',
        name: 'Projects',
        note: 'Active projects',
        k: 0,
        ch: [
            {
                id: 'mock-project-cli',
                name: 'WorkflowyCLI',
                note: 'CLI tool for Workflowy',
                k: 0,
                ch: [
                    { id: 'mock-task-1', name: 'Add search feature', k: 0 },
                    { id: 'mock-task-2', name: 'Fix bugs', note: 'See bug tracker', k: 1 },
                    { id: 'mock-task-3', name: 'Write tests', k: 2, completedAt: Date.now() - 86400000 }
                ]
            },
            {
                id: 'mock-project-website',
                name: 'Website Redesign',
                k: 1,
                ch: [
                    { id: 'mock-web-1', name: 'Design mockups', k: 0 },
                    { id: 'mock-web-2', name: 'Implement header', k: 1 }
                ]
            }
        ]
    },
    {
        id: 'mock-personal',
        name: 'Personal',
        note: 'Personal items',
        k: 1,
        ch: [
            { id: 'mock-personal-1', name: 'Buy groceries', k: 0 },
            { id: 'mock-personal-2', name: 'Call mom', k: 1, completedAt: Date.now() - 3600000 }
        ]
    },
    {
        id: 'mock-archive',
        name: 'Archive',
        k: 2,
        ch: []
    }
];

export class MockWorkflowyClient {
    private data: WorkflowyNode[];
    private nextId: number = 1;

    constructor() {
        // Deep clone the default tree so each instance starts fresh
        this.data = JSON.parse(JSON.stringify(DEFAULT_MOCK_TREE));
    }

    /**
     * Reset to default state (useful between tests)
     */
    reset(): void {
        this.data = JSON.parse(JSON.stringify(DEFAULT_MOCK_TREE));
        this.nextId = 1;
    }

    /**
     * Get the current in-memory tree (for test assertions)
     */
    getTree(): WorkflowyNode[] {
        return this.data;
    }

    // --- API Methods (mirror WorkflowyClient interface) ---

    setApiKey(_key: string): void {
        // No-op for mock
    }

    getApiKey(): string | undefined {
        return 'mock-api-key';
    }

    async getNodes(parentId: string = 'None'): Promise<WorkflowyNode[]> {
        // Simulate network delay
        await this.delay(10);

        if (parentId === 'None') {
            return JSON.parse(JSON.stringify(this.data));
        }

        const parent = this.findNode(parentId);
        return parent?.ch ? JSON.parse(JSON.stringify(parent.ch)) : [];
    }

    async createNode(parentId: string, name: string, note?: string): Promise<WorkflowyNode> {
        await this.delay(10);

        const newNode: WorkflowyNode = {
            id: `mock-new-${this.nextId++}`,
            name,
            ...(note !== undefined && { note }),
            k: 0
        };

        if (parentId === 'None') {
            // Add to root
            this.data.push(newNode);
            this.reorderChildren(this.data);
        } else {
            const parent = this.findNode(parentId);
            if (!parent) {
                throw new Error(`Parent node not found: ${parentId}`);
            }
            parent.ch = parent.ch || [];
            parent.ch.push(newNode);
            this.reorderChildren(parent.ch);
        }

        return newNode;
    }

    async updateNode(id: string, updates: Partial<WorkflowyNode>): Promise<WorkflowyNode> {
        await this.delay(10);

        const node = this.findNode(id);
        if (!node) {
            throw new Error(`Node not found: ${id}`);
        }

        if (updates.name !== undefined) node.name = updates.name;
        if (updates.note !== undefined) node.note = updates.note;

        return node;
    }

    async deleteNode(id: string): Promise<void> {
        await this.delay(10);

        const removed = this.removeFromTree(this.data, id);
        if (!removed) {
            throw new Error(`Node not found: ${id}`);
        }
    }

    async completeNode(id: string): Promise<void> {
        await this.delay(10);

        const node = this.findNode(id);
        if (!node) {
            throw new Error(`Node not found: ${id}`);
        }

        node.completedAt = Date.now();
    }

    async uncompleteNode(id: string): Promise<void> {
        await this.delay(10);

        const node = this.findNode(id);
        if (!node) {
            throw new Error(`Node not found: ${id}`);
        }

        node.completedAt = null;
    }

    async moveNode(id: string, parentId: string, priority: number): Promise<WorkflowyNode> {
        await this.delay(10);

        const node = this.findNode(id);
        if (!node) {
            throw new Error(`Node not found: ${id}`);
        }

        // Remove from current location
        this.removeFromTree(this.data, id);

        // Add to new location
        node.k = priority;
        if (parentId === 'None') {
            this.data.push(node);
            this.reorderChildren(this.data);
        } else {
            const parent = this.findNode(parentId);
            if (!parent) {
                throw new Error(`Parent node not found: ${parentId}`);
            }
            parent.ch = parent.ch || [];
            parent.ch.push(node);
            this.reorderChildren(parent.ch);
        }

        return node;
    }

    // --- Helper Methods ---

    private findNode(id: string, nodes: WorkflowyNode[] = this.data): WorkflowyNode | null {
        for (const node of nodes) {
            if (node.id === id) return node;
            if (node.ch) {
                const found = this.findNode(id, node.ch);
                if (found) return found;
            }
        }
        return null;
    }

    private removeFromTree(nodes: WorkflowyNode[], id: string): boolean {
        const idx = nodes.findIndex(n => n.id === id);
        if (idx >= 0) {
            nodes.splice(idx, 1);
            return true;
        }
        for (const node of nodes) {
            if (node.ch && this.removeFromTree(node.ch, id)) {
                return true;
            }
        }
        return false;
    }

    private reorderChildren(nodes: WorkflowyNode[]): void {
        nodes.sort((a, b) => (a.k || 0) - (b.k || 0));
        nodes.forEach((node, i) => {
            node.k = i;
        });
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Check if mock mode is enabled
 */
export function isMockMode(): boolean {
    return process.env.WF_MOCK === '1' || process.env.WF_MOCK === 'true';
}
