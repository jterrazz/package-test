import { basename, resolve } from 'node:path';

import { resolveSpecPath } from './resolve.js';

/**
 * Copy semantics for the file-state a command spec stands on — the chain's
 * `.fixtureFile()` / `.fixtureDirectory()` and a document's `fixture:`.
 *
 * The source is a path relative to the spec (or document) naming it, and the
 * shared pool is reached the same way, by the path that climbs to it
 * (`../../fixtures/shop/`). Copy semantics follow rsync's trailing-slash rule
 * (see {@link copyPlan}).
 */

/** A resolved copy operation: where to read from, where to write to. */
type FixtureCopyPlan = {
    dest: string;
    src: string;
};

/**
 * Compute the source + destination for copying a fixture into the working
 * directory:
 *
 *  - `./dir/` (trailing slash) — the CONTENTS are spread into the cwd.
 *  - `./file` — copied as `<cwd>/<basename>`.
 *
 * A path without the slash that names a directory is copied as
 * `<cwd>/<basename>` too — the `fixture:` key of a document takes both forms;
 * the chain splits them into two verbs.
 *
 * Chained fixtures layer in order: a later one overwrites files written by an
 * earlier one.
 */
export function copyPlan(
    path: string,
    specDir: string,
    workDir: string,
    verb = 'fixture',
): FixtureCopyPlan {
    const src = resolveSpecPath(verb, path, specDir);
    const spread = path.endsWith('/');
    const dest = spread ? workDir : resolve(workDir, basename(src));
    return { dest, src };
}
