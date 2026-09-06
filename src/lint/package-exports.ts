import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readFileCached } from './fs-cache.js';

/**
 * The subpaths this package actually publishes, read from its OWN
 * `package.json` `exports` map.
 *
 * Rule F1 forbids importing `@jterrazz/test/<subpath>` — but a subpath the
 * package DECLARES is, by definition, part of its public contract
 * (`/oxlint` for the lint plugin, `/vitest` for the runner-config surface).
 * Deriving the exemption from the manifest rather than listing it in the rule
 * is what keeps the two from drifting: a subpath is exempt the moment it is
 * published, and stops being exempt the moment it is withdrawn — there is
 * nothing to remember to update.
 *
 * The manifest is found by walking up from THIS module, so the answer does not
 * depend on where the linted file sits: `<pkg>/dist/oxlint.js` in an install,
 * `<repo>/src/lint/` when the framework lints itself. `import.meta.url` is
 * safe in both bundle formats — the CJS build shims it to `__filename`.
 */

const PACKAGE = '@jterrazz/test';

/** Manifests are read once per lint process. */
let cached: null | string[] = null;

/**
 * Walk up from `startDir` for the `package.json` that declares {@link PACKAGE}.
 * The FIRST manifest found decides: if it names another package, the walk has
 * already left this package's tree and there is nothing to find above it.
 */
function findOwnManifest(startDir: string): null | Record<string, unknown> {
    let dir = startDir;
    for (;;) {
        const text = readFileCached(join(dir, 'package.json'));
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

/**
 * Every subpath specifier the package publishes — `@jterrazz/test/oxlint`,
 * `@jterrazz/test/vitest`, … The root export (`.`) is not a subpath and is
 * absent from the list.
 *
 * An unreadable manifest yields an EMPTY list: with no contract to read, no
 * subpath can be vouched for, and F1's plain rule applies.
 *
 * @internal Exported for unit tests.
 */
export function declaredSubpaths(startDir?: string): string[] {
    if (startDir === undefined && cached !== null) {
        return cached;
    }
    const from = startDir ?? dirname(fileURLToPath(import.meta.url));
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
