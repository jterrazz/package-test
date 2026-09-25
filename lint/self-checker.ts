import { checkCapabilityFolder } from './checker-capability.js';
import { checkEngineOwner, checkFacetIsolation } from './checker-source-imports.js';
import { checkFolderShape, checkSourceRoot } from './checker-source-tree.js';
import type { TokenViolation } from './checker.js';

/** `dist/checker.js` imports nothing from here, so no consumer run can reach a self pass. */
export const SELF_PASS_IDS = [
    'c35-capability-folder',
    'i9-source-root',
    'i10-facet-isolation',
    'i11-engine-owner',
    'i12-folder-shape',
] as const;

export type SelfPassId = (typeof SELF_PASS_IDS)[number];

export function runSelfChecks(specsRoot: string): TokenViolation[] {
    return checkCapabilityFolder(specsRoot);
}

export function runSelfSourceChecks(root: string): TokenViolation[] {
    return [
        ...checkSourceRoot(root),
        ...checkFacetIsolation(root),
        ...checkEngineOwner(root),
        ...checkFolderShape(root),
    ];
}
