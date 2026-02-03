import Conf from 'conf';
import { isMockMode } from '../api/index.js';
import type { PathSegment } from './types.js';
import type { WorkflowyNode } from '../api/index.js';

const PROJECT_NAME = 'workflowycli-session';

export class SessionState {
    private config: Conf<{ lastPath: PathSegment[] }>;
    private _currentPath: PathSegment[] = [];
    private _currentNodeId: string = "None";

    constructor() {
        const suffix = isMockMode() ? '-mock' : '';
        this.config = new Conf({
            projectName: `${PROJECT_NAME}${suffix}`,
            clearInvalidConfig: true
        });
    }

    async load() {
        if (process.env.WF_RESET) {
            this.config.clear();
        }

        // Persistence disabled per user request in original code ("None" default)
        // But let's check if we want to honor the architecture for later enabling.
        // Original code: this.currentPath = [{ id: "None", name: "/" }];

        this._currentPath = [{ id: "None", name: "/" }];
        this._currentNodeId = "None";
    }

    save() {
        // No-op: Persistence disabled in original code
        // this.config.set('lastPath', this._currentPath);
    }

    get currentPath(): PathSegment[] {
        return this._currentPath;
    }

    get currentNodeId(): string {
        return this._currentNodeId;
    }

    // Mutators

    setNode(node: WorkflowyNode) {
        this._currentNodeId = node.id;
        this._currentPath.push({ id: node.id, name: node.name });
        this.save();
    }

    // For "absolute" jumps where we reconstruct the whole path
    setPath(path: PathSegment[]) {
        if (path.length === 0) {
            this.resetToRoot();
            return;
        }
        this._currentPath = path;
        const last = path[path.length - 1];
        if (last) {
            this._currentNodeId = last.id;
        } else {
            // Should not happen if length check passes, but TS complains
            this._currentNodeId = "None";
        }
        this.save();
    }

    popPath() {
        if (this._currentPath.length > 1) {
            this._currentPath.pop();
            const parent = this._currentPath[this._currentPath.length - 1];
            if (parent) this._currentNodeId = parent.id;
        }
        this.save();
    }

    resetToRoot() {
        this._currentPath = [{ id: "None", name: "/" }];
        this._currentNodeId = "None";
        this.save();
    }
}
