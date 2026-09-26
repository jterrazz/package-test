import type { TokenViolation } from '../../checks/checker.js';
import { checkEngineOwner, checkFacetIsolation } from './source-imports.js';
import { checkFolderShape, checkSourceRoot } from './source-tree.js';
import { checkCapabilityFolder } from './specimen-filed-by-capability.js';

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
