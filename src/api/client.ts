import Conf from 'conf';

export interface WorkflowyNode {
    id: string;
    name: string;
    note?: string;
    k?: number; // Backend order (priority)
    completedAt?: number | null;
    ch?: WorkflowyNode[]; // Children
}

export interface WorkflowyResponse {
    projectTreeData: {
        mainProjectTreeInfo: {
            rootProjectChildren: WorkflowyNode[];
        }
    }
}

const config = new Conf<{ apiKey: string }>({
    projectName: 'workflowycli'
});

// Base URL for V1 API (production endpoint)
// Base URL for V1 API (production endpoint)
const BASE_URL = "https://workflowy.com/api/v1";

class Semaphore {
    private permits: number;
    private queue: (() => void)[] = [];

    constructor(permits: number) {
        this.permits = permits;
    }

    async acquire() {
        if (this.permits > 0) {
            this.permits--;
            return;
        }
        await new Promise<void>(resolve => this.queue.push(resolve));
    }

    release() {
        this.permits++;
        if (this.queue.length > 0 && this.permits > 0) {
            this.permits--;
            const next = this.queue.shift();
            if (next) next();
        }
    }
}

// Global semaphore to limit concurrent requests across all client instances
const requestSemaphore = new Semaphore(2);

export class WorkflowyClient {
    private apiKey: string | undefined;

    constructor() {
        this.apiKey = config.get('apiKey');
    }

    setApiKey(key: string) {
        this.apiKey = key;
        config.set('apiKey', key);
    }

    getApiKey(): string | undefined {
        return this.apiKey;
    }

    private async request(endpoint: string, options: RequestInit = {}, retries = 5): Promise<any> {
        if (!this.apiKey) {
            throw new Error("API Key not found. Please log in first.");
        }

        // Acquire lock
        await requestSemaphore.acquire();

        try {
            const url = `${BASE_URL}${endpoint}`;
            const headers = {
                "Authorization": `Bearer ${this.apiKey}`,
                "Content-Type": "application/json",
                ...options.headers,
            };

            const response = await fetch(url, { ...options, headers });

            if (response.status === 429) {
                if (retries > 0) {
                    // Check Retry-After header
                    const retryAfter = response.headers.get('Retry-After');
                    let delay = 1000;

                    if (retryAfter) {
                        const seconds = parseInt(retryAfter, 10);
                        if (!isNaN(seconds)) {
                            delay = seconds * 1000;
                        } else {
                            // Could be date string, but Workflowy usually sends seconds
                        }
                    } else {
                        // Exponential backoff: 2s, 4s, 8s, 16s, 32s with jitter
                        const baseDelay = Math.pow(2, 6 - retries) * 1000;
                        const jitter = Math.random() * 500;
                        delay = baseDelay + jitter;
                    }

                    // Release lock while waiting so others can try (or not? better to hold if global rate limit?)
                    // If we hold, we block everyone. If we release, we might let others hit limit.
                    // Usually better to release and let the queue manage flow.
                    requestSemaphore.release();
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return this.request(endpoint, options, retries - 1);
                }
            }

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            const text = await response.text();
            return text ? JSON.parse(text) : {};
        } finally {
            // Always release lock
            requestSemaphore.release();
        }
    }

    /**
     * Fetches the children of a specific node.
     * If parentId is "None" or not provided, fetches root.
     */
    async getNodes(parentId: string = "None"): Promise<WorkflowyNode[]> {
        const url = `/nodes?parent_id=${parentId}`;
        const data = await this.request(url);
        return data.nodes || [];
    }

    async createNode(parentId: string, name: string, note?: string): Promise<WorkflowyNode> {
        // POST /api/v1/nodes
        const body: any = { parent_id: parentId, name };
        if (note) body.note = note;

        const data = await this.request('/nodes', {
            method: 'POST',
            body: JSON.stringify(body)
        });
        return data; // returns the new node
    }

    async updateNode(id: string, updates: Partial<WorkflowyNode>): Promise<WorkflowyNode> {
        // POST /api/v1/nodes/:id (Based on documentation summary)
        // Body: { name: "...", note: "..." }
        const data = await this.request(`/nodes/${id}`, {
            method: 'POST', // Doc summary said POST
            body: JSON.stringify(updates)
        });
        return data;
    }

    async deleteNode(id: string): Promise<void> {
        // DELETE /api/v1/nodes/:id
        await this.request(`/nodes/${id}`, {
            method: 'DELETE'
        });
    }

    async completeNode(id: string): Promise<void> {
        // POST /api/v1/nodes/:id/complete
        await this.request(`/nodes/${id}/complete`, {
            method: 'POST'
        });
    }

    async uncompleteNode(id: string): Promise<void> {
        // POST /api/v1/nodes/:id/uncomplete
        await this.request(`/nodes/${id}/uncomplete`, {
            method: 'POST'
        });
    }

    async moveNode(id: string, parentId: string, priority: number): Promise<WorkflowyNode> {
        // API Doc: POST /api/v1/nodes/:id/move
        // Parameters: parent_id, priority
        const data = await this.request(`/nodes/${id}/move`, {
            method: 'POST',
            body: JSON.stringify({ parent_id: parentId, priority })
        });
        return data;
    }
}
