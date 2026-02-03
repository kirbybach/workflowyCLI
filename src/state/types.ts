import type { WorkflowyNode } from "../api/index.js";

export interface PathSegment {
    id: string;
    name: string;
}

export interface SearchResult {
    node: WorkflowyNode;
    path: PathSegment[]; // Breadcrumbs to this node
    matchField: 'name' | 'note';
    matchContent: string;
}

export interface SearchOptions {
    includeNotes?: boolean;
    limit?: number;
    isRegex?: boolean;
}
