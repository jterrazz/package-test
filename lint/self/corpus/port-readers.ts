import { readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { treeEntries } from '../../../src/kernel/files/git-tree.js';

/** Meta-test `server-binds-port-zero`: a picked-then-bound port is a window another server can take, so a server binds 0 and announces; nothing on the host reads `PORT`. A folder holding a `Dockerfile` is a container's, whose ports are its own. */

/** The proof of the PORT form itself: its children report the port they were handed and never bind it. */
const PORT_FORM_PROOF = 'src/world/services/process/serve.test.ts';

const HANDED_PORT = /process\.env\.PORT\b|\$PORT\b|\$\{PORT\}/u;

const SOURCE = /\.(?:[cm]?[jt]sx?|ya?ml)$/u;

function hostFiles(dir: string): string[] {
    const entries = treeEntries(dir);
    if (entries.some((entry) => entry.isFile() && entry.name === 'Dockerfile')) {
        return [];
    }
    return entries.flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
            return hostFiles(path);
        }
        return entry.isFile() ? [path] : [];
    });
}

export function portReaders(root: string): string[] {
    const specs = hostFiles(resolve(root, 'specs'));
    const moduleTests = hostFiles(resolve(root, 'src')).filter((path) =>
        /\.test\.tsx?$/u.test(path),
    );
    return [...specs, ...moduleTests]
        .filter((path) => SOURCE.test(path) && HANDED_PORT.test(readFileSync(path, 'utf8')))
        .map((path) => relative(root, path).replaceAll('\\', '/'))
        .filter((path) => path !== PORT_FORM_PROOF)
        .toSorted();
}
