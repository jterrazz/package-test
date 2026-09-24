import { isGroundName, SHARED_GROUND } from '../src/model/chain/ground.js';
import { FACETS } from './config-shape.js';
import { isDirectory, listDirectory } from './fs-cache.js';

/**
 * The first level of a specs tree: a facet, `shared/`, or a repository suite —
 * a folder holding tests of its own. A folder that is none of the three (a
 * `support/` of helpers and mocks) is no place a spec tree has, and C1 refuses
 * each module in it.
 */

/** A file that declares tests: a `.test.ts(x)`, a `.spec.ts`, a `<case>.spec.yaml`. */
export function declaresTests(name: string): boolean {
    return /\.(?:test\.tsx?|spec\.ts|spec\.yaml)$/u.test(name);
}

/** Does the folder hold a test anywhere below it — its ground and `node_modules/` aside? */
function holdsATest(folder: string): boolean {
    return (listDirectory(folder) ?? []).some((name) => {
        const path = `${folder}/${name}`;
        if (isDirectory(path)) {
            return !isGroundName(name) && name !== 'node_modules' && holdsATest(path);
        }
        return declaresTests(name);
    });
}

/**
 * Does a file at `relative` below the specs root `specs` sit in a first-level
 * folder that is no facet, not `shared/`, and holds no test?
 */
export function isStrayFolder(specs: string, relative: readonly string[]): boolean {
    const [first = ''] = relative;
    return (
        relative.length > 1 &&
        !FACETS.has(first) &&
        first !== SHARED_GROUND &&
        !holdsATest(`${specs}/${first}`)
    );
}
