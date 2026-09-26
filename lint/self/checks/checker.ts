import type { Finding } from '../../checks/checker.js';
import { checkFolderNamedForAConcept } from './folder-named-for-a-concept.js';
import { checkLintImportsFollowTheDirection } from './lint-imports-follow-the-direction.js';
import { checkNoCrossFacetImport } from './no-cross-facet-import.js';
import { checkOneOwnerPerEngine } from './one-owner-per-engine.js';
import { checkSourceRootHoldsKnownEntries } from './source-root-holds-known-entries.js';
import { checkSpecimenFiledByCapability } from './specimen-filed-by-capability.js';

/** `dist/checker.js` imports nothing from here, so no consumer run can reach a self pass. */
export const SELF_PASS_IDS = [
    'specimen-filed-by-capability',
    'source-root-holds-known-entries',
    'no-cross-facet-import',
    'one-owner-per-engine',
    'folder-named-for-a-concept',
    'lint-imports-follow-the-direction',
] as const;

export type SelfPassId = (typeof SELF_PASS_IDS)[number];

export function runSelfChecks(specsRoot: string): Finding<SelfPassId>[] {
    return checkSpecimenFiledByCapability(specsRoot);
}

export function runSelfSourceChecks(root: string): Finding<SelfPassId>[] {
    return [
        ...checkSourceRootHoldsKnownEntries(root),
        ...checkNoCrossFacetImport(root),
        ...checkOneOwnerPerEngine(root),
        ...checkFolderNamedForAConcept(root),
        ...checkLintImportsFollowTheDirection(root),
    ];
}
