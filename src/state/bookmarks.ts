import Conf from 'conf';

export interface Bookmark {
    name: string;
    nodeId: string;
    path: string; // Breadcrumb path at time of bookmarking (for display/reference)
    createdAt: number;
}

const config = new Conf<{ bookmarks: Bookmark[] }>({
    projectName: 'workflowycli-bookmarks',
    clearInvalidConfig: true
});

export class BookmarkService {

    list(): Bookmark[] {
        return config.get('bookmarks', []);
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

        config.set('bookmarks', bookmarks);
    }

    get(name: string): Bookmark | undefined {
        return this.list().find(b => b.name === name);
    }

    delete(name: string): boolean {
        const bookmarks = this.list();
        const initialLen = bookmarks.length;
        const filtered = bookmarks.filter(b => b.name !== name);

        if (filtered.length !== initialLen) {
            config.set('bookmarks', filtered);
            return true;
        }
        return false;
    }
}
