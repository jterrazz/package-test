import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

/**
 * Resolve root — if relative, resolves from the caller's directory.
 */
export function resolveProjectRoot(root: string | undefined): string {
    if (!root) {
        return process.cwd();
    }

    if (isAbsolute(root)) {
        return root;
    }

    const stack = new Error('resolve root').stack;
    if (stack) {
        const lines = stack.split('\n');
        for (const line of lines) {
            const match = line.match(/at\s+(?:.*?\()?(?:file:\/\/)?([^:)]+):\d+:\d+/);
            if (!match) {
                continue;
            }

            const filePath = match[1];
            if (filePath.includes('node_modules') || filePath.includes('/src/spec/')) {
                continue;
            }

            return resolve(filePath, '..', root);
        }
    }

    return resolve(process.cwd(), root);
}

/**
 * Resolve a CLI command — checks node_modules/.bin, then treats as absolute/PATH.
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
