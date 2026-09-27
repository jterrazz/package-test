import type { AtZeroRegistry } from '../../engine/checker/registry.js';
import { SELF_CHAPTER, selfRows } from '../catalogue/manifest.js';
import { checkErrorIsARefusalOrAnInvariant } from './error-is-a-refusal-or-an-invariant.js';
import { checkFolderNamedForAConcept } from './folder-named-for-a-concept.js';
import { checkOneWordForAnAdapter } from './one-word-for-an-adapter.js';
import { checkSourceRootHoldsKnownEntries } from './source-root-holds-known-entries.js';
import { checkSpecimenFiledByCapability } from './specimen-filed-by-capability.js';
import { checkStubsReachedByTheirSurface } from './stubs-reached-by-their-surface.js';

/** `dist/checker.js` imports nothing from here, so no consumer run can reach a self pass. */
export const SELF_CHECKER_PASS_IDS = [
    'specimen-filed-by-capability',
    'source-root-holds-known-entries',
    'folder-named-for-a-concept',
    'stubs-reached-by-their-surface',
    'one-word-for-an-adapter',
    'error-is-a-refusal-or-an-invariant',
] as const;

export type SelfPassId = (typeof SELF_CHECKER_PASS_IDS)[number];

export const SELF_CHECKER: AtZeroRegistry = {
    chapter: SELF_CHAPTER,
    label: 'self checker',
    passIds: SELF_CHECKER_PASS_IDS,
    rows: selfRows,
    source: [
        checkSourceRootHoldsKnownEntries,
        checkFolderNamedForAConcept,
        checkStubsReachedByTheirSurface,
        checkOneWordForAnAdapter,
        checkErrorIsARefusalOrAnInvariant,
    ],
    specs: [checkSpecimenFiledByCapability],
};
