import { holdsManifest, nearestRoot } from '@jterrazz/typescript/rules';
import { existsSync, realpathSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

export const installRootOf = (from: string): string | undefined =>
    nearestRoot(from, (directory) => existsSync(join(directory, 'package.json')));

export function discoverRoot(startDir: string): string {
    return nearestRoot(startDir, holdsManifest) ?? startDir;
}

export function resolveRoot(root: string | undefined, callerDir: string): string {
    if (root === undefined || root === '') {
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
