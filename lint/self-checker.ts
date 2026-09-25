import { checkCapabilityFolder } from './checker-capability.js';
import { checkEngineOwner, checkFacetIsolation } from './checker-source-imports.js';
import { checkFolderShape, checkSourceRoot } from './checker-source-tree.js';
import type { TokenViolation } from './checker.js';

/**
 * The checker passes whose audience is `self` — this package's own suite
 * discipline and its own source tree, read the way a consumer pass reads a
 * specs tree.
 *
 * They run in `dist/self-checker.js`, which `npm run lint` calls after the
 * published checker and which the tarball never carries: `dist/checker.js`
 * imports nothing from this module, so no consumer run can reach one.
 */
export const SELF_PASS_IDS = [
    'c35-capability-folder',
    'i9-source-root',
    'i10-facet-isolation',
    'i11-engine-owner',
    'i12-folder-shape',
] as const;

/** The name of a pass only this package runs. */
export type SelfPassId = (typeof SELF_PASS_IDS)[number];

/** Run every self pass over one specs tree; findings are relative to it. */
export function runSelfChecks(specsRoot: string): TokenViolation[] {
    return checkCapabilityFolder(specsRoot);
}

/**
 * Run every self pass over a project's source tree — its `src/`, and the
 * `lint/` beside it; findings are relative to the project root, and a root
 * with no `src/` yields none.
 */
export function runSelfSourceChecks(root: string): TokenViolation[] {
    return [
        ...checkSourceRoot(root),
        ...checkFacetIsolation(root),
        ...checkEngineOwner(root),
        ...checkFolderShape(root),
    ];
}
