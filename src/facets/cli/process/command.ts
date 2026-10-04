import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** An absolute path as is; else the project's `node_modules/.bin`, then the working directory's; else the bare name. */
export function resolveCommand(command: string, root: string): string {
    // invariant: an absolute command resolves to itself under any directory.
    const installed = [root, process.cwd()]
        .map((directory) => resolve(directory, 'node_modules/.bin', command))
        .find((path) => existsSync(path));
    return installed ?? command;
}
