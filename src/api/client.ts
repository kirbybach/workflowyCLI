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

// Base URL for V1 API
const BASE_URL = "https://beta.workflowy.com/api/v1";
// Note: Doc said beta.workflowy.com/api-reference/ usually points to beta, but endpoints might be workflowy.com?
// Summaries showed: curl -G https://workflowy.com/api/v1/nodes
// Use workflowy.com as primary? Or beta?
// The curl example said `workflowy.com`. The documentation URL was `beta.workflowy.com`.
// I'll stick to `workflowy.com` but maybe beta is safer for API?
// Let's use `https://workflowy.com/api/v1` as seen in the curl example.
// Actually the summary text I read earlier: "curl -G https://workflowy.com/api/v1/nodes"
// So I will use that.

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

    private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
        if (!this.apiKey) {
            throw new Error("API Key not found. Please log in first.");
        }

        const url = `${BASE_URL}${endpoint}`;
        const headers = {
            "Authorization": `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            ...options.headers,
        };

        const response = await fetch(url, { ...options, headers });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        // For DELETE/POST complete, response might be empty?
        // API doc said "Response ... { ... }" usually.
        // We'll try to find json.
        const text = await response.text();
        return text ? JSON.parse(text) : {};
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
