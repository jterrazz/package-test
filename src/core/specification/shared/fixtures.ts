import { basename, dirname, resolve } from 'node:path';

/**
 * Fixture path resolution + copy semantics for the `cli` facet's `.fixture()`.
 *
 * A fixture path is one of two shapes:
 *
 *  - `$FIXTURES/<rest>` — the shared pool at `<specs-root>/fixtures/<rest>`,
 *    where `<specs-root>` is the nearest ancestor directory named `specs`.
 *  - `<path>` (no marker) — feature-local, at `<test-dir>/fixtures/<path>`.
 *
 * Any other `$`-prefixed marker is a usage error (listed against the known
 * markers). Copy semantics mirror rsync's trailing-slash rule (see
 * {@link copyPlan}).
 */

/**
 * Markers understood in a `.fixture()` path. Extend here + in
 * {@link resolveFixtureSource}. Exported so the lint layer (rule
 * `jterrazz/b2-known-fixture-marker`) validates literals against the same list.
 */
export const KNOWN_FIXTURE_MARKERS = ['$FIXTURES'] as const;

/**
 * Walk up from `startDir` to the nearest ancestor directory named `specs`.
 * Throws with guidance if none is found up to the filesystem root — the
 * `$FIXTURES` marker is meaningless without a specs root.
 */
export function discoverSpecsRoot(startDir: string): string {
    let dir = startDir;
    for (;;) {
        if (basename(dir) === 'specs') {
            return dir;
        }
        const parent = dirname(dir);
        if (parent === dir) {
            break;
        }
        dir = parent;
    }
    throw new Error(
        `.fixture(): the $FIXTURES marker resolves to <specs-root>/fixtures, but no directory ` +
            `named "specs" was found walking up from ${startDir}. Move the specification under a ` +
            `specs/ directory, or use a feature-local fixtures/ path (no $FIXTURES marker).`,
    );
}

/**
 * Resolve the absolute source path of a fixture, applying marker resolution.
 * The trailing slash (spread semantics) is preserved by callers via
 * {@link copyPlan} — it is irrelevant to source resolution.
 */
export function resolveFixtureSource(path: string, testDir: string): string {
    const clean = path.replace(/\/+$/, '');
    if (clean === '$FIXTURES' || path.startsWith('$FIXTURES/')) {
        const rest = clean.slice('$FIXTURES'.length).replace(/^\/+/, '');
        return resolve(discoverSpecsRoot(testDir), 'fixtures', rest);
    }
    if (path.startsWith('$')) {
        const marker = clean.split('/')[0];
        throw new Error(
            `.fixture("${path}"): unknown marker "${marker}". Known markers: ` +
                `${KNOWN_FIXTURE_MARKERS.join(', ')}. A path without a marker is feature-local ` +
                `(resolved under <test-dir>/fixtures/).`,
        );
    }
    return resolve(testDir, 'fixtures', clean);
}

/** A resolved copy operation: where to read from, where to write to. */
interface FixtureCopyPlan {
    dest: string;
    src: string;
}

/**
 * Compute the source + destination for copying a fixture into the working
 * directory. Copy semantics follow rsync's trailing-slash rule:
 *
 *  - `dir/` (trailing slash) — the CONTENTS are spread into the cwd.
 *  - `dir`  (no slash, a directory) — the directory is copied as `<cwd>/<basename>`.
 *  - `file` — copied as `<cwd>/<basename>`.
 *
 * Chained `.fixture()` calls layer in order: a later fixture overwrites files
 * written by an earlier one.
 */
export function copyPlan(path: string, testDir: string, workDir: string): FixtureCopyPlan {
    const src = resolveFixtureSource(path, testDir);
    const spread = /\/+$/.test(path);
    const dest = spread ? workDir : resolve(workDir, basename(src));
    return { dest, src };
}
