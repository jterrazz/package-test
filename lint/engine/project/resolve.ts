import { treeKind } from '@jterrazz/typescript/rules';
import { realpathSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

const ROOT_MARKER = 'package.json';

export function findRoot(startDir: string, exists: (path: string) => boolean): string | undefined {
    let dir = startDir;
    for (;;) {
        if (exists(resolve(dir, ROOT_MARKER))) {
            return dir;
        }
        const parent = dirname(dir);
        if (parent === dir) {
            return undefined;
        }
        dir = parent;
    }
}

export function discoverRoot(startDir: string): string {
    return findRoot(startDir, (path) => treeKind(path) === 'file') ?? startDir;
}

export function resolveRoot(root: string | undefined, callerDir: string): string {
    if (!root) {
        return discoverRoot(callerDir);
    }
    if (isAbsolute(root)) {
        return root;
    }
    return resolve(callerDir, root);
}

/** What a child process prints as `$PWD` (macOS resolves the tmpdir symlink); the path itself when it cannot resolve. */
export function safeRealpath(path: string): string {
    try {
        return realpathSync(path);
    } catch {
        return path;
    }
}
