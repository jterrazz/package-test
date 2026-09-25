import { cpSync, existsSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';

import { resolveSpecPath } from '../../model/chain/resolve.js';
import { refusal } from '../../model/lesson/refusal.js';

/**
 * Copy semantics for the file-state a command spec stands on — the chain's
 * `.fixture(file(…))` / `.fixture(directory(…))` and a document's `fixture:`.
 *
 * The source is a path relative to the spec (or document) naming it, and the
 * shared pool is reached the same way, by the path that climbs to it
 * (`../../shared/fixtures/shop/`). The trailing `/` is what says which of the two a
 * path is, in both doors (see {@link copyPlan}).
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
 *  - `./dir/` (trailing slash) — a directory, its CONTENTS spread into the cwd;
 *  - `./file` — one file, copied as `<cwd>/<basename>`.
 *
 * A path that says one and names the other on disk is refused, and so is a
 * path that names nothing: the refusal carries the resolved path.
 *
 * Chained fixtures layer in order: a later one overwrites files written by an
 * earlier one.
 */
export function copyPlan(path: string, specDir: string, workDir: string): FixtureCopyPlan {
    const src = resolveSpecPath('fixture', path, specDir);
    if (!existsSync(src)) {
        throw new Error(
            refusal('b2-relative-path-runtime', {
                fix: `create ${src}, or correct the path`,
                found: `fixture: ${JSON.stringify(path)} names nothing — ${src} does not exist`,
            }),
        );
    }
    const spread = path.endsWith('/');
    const isDirectory = statSync(src).isDirectory();
    if (isDirectory !== spread) {
        throw new TypeError(
            refusal(
                'b2-relative-path-runtime',
                isDirectory
                    ? {
                          fix: `end its path in /: directory('${path}/') — its contents are spread into the working directory`,
                          found: `fixture: ${JSON.stringify(path)} names a directory`,
                      }
                    : {
                          fix: `drop the /: file('${path.replace(/\/+$/u, '')}')`,
                          found: `fixture: ${JSON.stringify(path)} names a file`,
                      },
            ),
        );
    }
    const dest = spread ? workDir : resolve(workDir, basename(src));
    return { dest, src };
}

/**
 * The fixtures a chain lays, copied onto this machine's disk by
 * {@link copyPlan}: its refusals are the copy's.
 */
export const fsFixtures: {
    readonly layer: (path: string, testDir: string, workDir: string) => void;
} = {
    layer: (path, testDir, workDir) => {
        const { dest, src } = copyPlan(path, testDir, workDir);
        cpSync(src, dest, { recursive: true });
    },
};
