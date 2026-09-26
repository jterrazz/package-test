import type { TokenViolation } from '../../checks/checker.js';
import { checkEngineOwner, checkFacetIsolation } from './source-imports.js';
import { checkFolderShape, checkSourceRoot } from './source-tree.js';
import { checkCapabilityFolder } from './specimen-filed-by-capability.js';

/** `dist/checker.js` imports nothing from here, so no consumer run can reach a self pass. */
export const SELF_PASS_IDS = [
    'specimen-filed-by-capability',
    'source-root-holds-known-entries',
    'no-cross-facet-import',
    'one-owner-per-engine',
    'folder-named-for-a-concept',
] as const;

export type SelfPassId = (typeof SELF_PASS_IDS)[number];

export function runSelfChecks(specsRoot: string): TokenViolation<SelfPassId>[] {
    return checkCapabilityFolder(specsRoot);
}

export function runSelfSourceChecks(root: string): TokenViolation<SelfPassId>[] {
    return [
        ...checkSourceRoot(root),
        ...checkFacetIsolation(root),
        ...checkEngineOwner(root),
        ...checkFolderShape(root),
    ];
}
