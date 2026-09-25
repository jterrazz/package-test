import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

/**
 * The binary a cli specification runs: an absolute path as it is; else the
 * project's own `node_modules/.bin`, then the working directory's; else the
 * bare name, for the shell to find on its PATH.
 */
export function resolveCommand(command: string, root: string): string {
    if (isAbsolute(command)) {
        return command;
    }
    const installed = [root, process.cwd()]
        .map((directory) => resolve(directory, 'node_modules/.bin', command))
        .find((path) => existsSync(path));
    return installed ?? command;
}
