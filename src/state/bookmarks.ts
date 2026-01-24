import Conf from 'conf';
import { isMockMode } from '../api/mock-client.js';

export interface Bookmark {
    name: string;
    nodeId: string;
    path: string; // Breadcrumb path at time of bookmarking (for display/reference)
    createdAt: number;
}

const PROJECT_NAME = 'workflowycli-bookmarks';

export class BookmarkService {
    private config: Conf<{ bookmarks: Bookmark[] }>;

    constructor() {
        const suffix = isMockMode() ? '-mock' : '';
        this.config = new Conf({
            projectName: `${PROJECT_NAME}${suffix}`,
            clearInvalidConfig: true
        });
    }

    list(): Bookmark[] {
        return this.config.get('bookmarks', []);
    }

    save(name: string, nodeId: string, path: string): void {
        const bookmarks = this.list();
        const existingIndex = bookmarks.findIndex(b => b.name === name);

        const newBookmark: Bookmark = {
            name,
            nodeId,
            path,
            createdAt: Date.now()
        };

        if (existingIndex >= 0) {
            bookmarks[existingIndex] = newBookmark;
        } else {
            bookmarks.push(newBookmark);
        }

        this.config.set('bookmarks', bookmarks);
    }

    get(name: string): Bookmark | undefined {
        return this.list().find(b => b.name === name);
    }

    delete(name: string): boolean {
        const bookmarks = this.list();
        const initialLen = bookmarks.length;
        const filtered = bookmarks.filter(b => b.name !== name);

        if (filtered.length !== initialLen) {
            this.config.set('bookmarks', filtered);
            return true;
        }
        return false;
    }
}
