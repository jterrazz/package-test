import { existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

/**
 * Auto-discover the project root from a starting directory (CONVENTIONS A9):
 * walk up to the first directory containing `docker/compose.test.yaml`;
 * if none, walk up to the first directory containing `package.json`;
 * if none, the starting directory itself.
 */
export function discoverRoot(startDir: string): string {
    for (const marker of ['docker/compose.test.yaml', 'package.json']) {
        let dir = startDir;
        for (;;) {
            if (existsSync(resolve(dir, marker))) {
                return dir;
            }
            const parent = dirname(dir);
            if (parent === dir) {
                break;
            }
            dir = parent;
        }
    }
    return startDir;
}

/**
 * Resolve the project root for a specification. An explicit `root` option is
 * an override (resolved from the caller's directory when relative); when
 * absent, the root is auto-discovered by walking up from the calling
 * specification file.
 */
export function resolveRoot(root: string | undefined, callerDir: string): string {
    if (!root) {
        return discoverRoot(callerDir);
    }
    if (isAbsolute(root)) {
        return root;
    }
    return resolve(callerDir, root);
}

/**
 * Resolve a command — checks node_modules/.bin, then treats as absolute/PATH.
 */
export function resolveCommand(command: string, root: string): string {
    if (isAbsolute(command)) {
        return command;
    }

    const binPath = resolve(root, 'node_modules/.bin', command);
    if (existsSync(binPath)) {
        return binPath;
    }

    const cwdBinPath = resolve(process.cwd(), 'node_modules/.bin', command);
    if (existsSync(cwdBinPath)) {
        return cwdBinPath;
    }

    return command;
}
