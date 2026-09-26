import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE = '@jterrazz/test';

let cached: null | string[] = null;

function readManifest(path: string): null | string {
    try {
        return readFileSync(path, 'utf8');
    } catch {
        return null;
    }
}

/** The first manifest found decides: naming another package, the walk has left this one's tree. */
function findOwnManifest(startDir: string): null | Record<string, unknown> {
    let dir = startDir;
    for (;;) {
        const text = readManifest(join(dir, 'package.json'));
        if (text !== null) {
            try {
                const manifest = JSON.parse(text) as Record<string, unknown>;
                return manifest.name === PACKAGE ? manifest : null;
            } catch {
                return null;
            }
        }
        const parent = dirname(dir);
        if (parent === dir) {
            return null;
        }
        dir = parent;
    }
}

export function declaredSubpaths(startDir?: string): string[] {
    if (startDir === undefined && cached !== null) {
        return cached;
    }
    const from = startDir ?? import.meta.dirname;
    const manifest = findOwnManifest(from);
    const exports = manifest?.exports;
    const subpaths =
        exports !== null && typeof exports === 'object'
            ? Object.keys(exports)
                  .filter((key) => key.startsWith('./') && key !== '.')
                  .map((key) => `${PACKAGE}/${key.slice(2)}`)
                  .sort()
            : [];
    if (startDir === undefined) {
        cached = subpaths;
    }
    return subpaths;
}
