import { readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { treeEntries } from '../src/seams/git/tree.js';

/**
 * The files of this package that read a port they were handed — meta-test K9.
 *
 * A port picked, released and then bound is a window: another server of the
 * same run can take it in between, and the spec then talks to a stranger. So a
 * server a spec starts binds port 0 and announces what it got, and the process
 * reads it off that line; nothing this package runs on the host reads
 * `process.env.PORT` or `$PORT`. A folder holding a `Dockerfile` is a
 * container's, whose ports are its own.
 */

/** Where a port is read from what the process was handed. */
const HANDED_PORT = /process\.env\.PORT\b|\$PORT\b|\$\{PORT\}/u;

/** A source a spec or a server is written in. */
const SOURCE = /\.(?:[cm]?[jt]sx?|ya?ml)$/u;

/** Every file under `dir` the tree holds, outside a container's folder. */
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

/**
 * Every file under `specs/`, and every module test under `src/`, that reads a
 * handed port — `/`-separated and relative to `root`, sorted.
 */
export function portReaders(root: string): string[] {
    const specs = hostFiles(resolve(root, 'specs'));
    const moduleTests = hostFiles(resolve(root, 'src')).filter((path) =>
        /\.test\.tsx?$/u.test(path),
    );
    return [...specs, ...moduleTests]
        .filter((path) => SOURCE.test(path) && HANDED_PORT.test(readFileSync(path, 'utf8')))
        .map((path) => relative(root, path).replaceAll('\\', '/'))
        .toSorted();
}
