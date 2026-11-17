import { treeEntries } from '@jterrazz/typescript/rules';
import { readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

// invariant: Meta-test `server-binds-port-zero`: a picked-then-bound port is a window another server can take, so a server binds 0 and announces; nothing on the host reads `PORT`. A folder holding a `Dockerfile` is a container's, whose ports are its own.

// invariant: the proof of the PORT form itself: its children report the port they were handed and never bind it.
const PORT_FORM_PROOF = 'src/services/process/__tests__/serve.test.ts';

const HANDED_PORT = /process\.env\.PORT\b|\$PORT\b|\$\{PORT\}/u;

const SOURCE = /\.(?:[cm]?[jt]sx?|ya?ml)$/u;

// invariant: a port read off a server the very next statement closes is a number the OS took back, any process's to take before it is pinned or probed; a test pins a drawn port (`pinnable()`), and probes a dead one on port 1.
const RELEASED_PORT =
    /[=]\s*await\s+[\w.]+\(\s*(?<server>\w+)\b[^;]*;\s*(?:await\s+)?(?:\k<server>\.close\(|\w*close\w*\(\s*\k<server>\b)/iu;

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

export function portReleasers(root: string): string[] {
    return [...hostFiles(resolve(root, 'specs')), ...hostFiles(resolve(root, 'src'))]
        .filter((path) => SOURCE.test(path) && RELEASED_PORT.test(readFileSync(path, 'utf8')))
        .map((path) => relative(root, path).replaceAll('\\', '/'))
        .toSorted();
}
