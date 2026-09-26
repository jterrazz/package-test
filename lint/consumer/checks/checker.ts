import { lessonAt, rowNamed } from '../../engine/catalogue/lesson.js';
import { reportLine } from '../../engine/checker/finding.js';
import type { Finding as CheckerFinding } from '../../engine/checker/finding.js';
import type { DocumentFinding as CheckerDocumentFinding } from '../../engine/project/document-model.js';
import { consumerRows } from '../catalogue/manifest.js';
import { checkCheckerSuppressionStatesAReason } from './checker-suppression-states-a-reason.js';
import { checkGroundAndDocuments } from './checker.ground.js';
import { checkDatabaseNamedOnlyWhenSeveral } from './database-named-only-when-several.js';
import { checkDockerExecBoundWithAwaitUsing } from './docker-exec-bound-with-await-using.js';
import { checkDocumentDescriptionUnique } from './document-description-unique.js';
import { checkFacetFolderHasSpecification } from './facet-folder-has-specification.js';
import { checkFacetTestUsesItsRunner } from './facet-test-uses-its-runner.js';
import { checkFileSuffixMatchesPlace } from './file-suffix-matches-place.js';
import { checkGroundBesideItsOnlyReader } from './ground-beside-its-only-reader.js';
import { checkGroundSharedOrInline } from './ground-shared-or-inline.js';
import { checkNamedPathExists } from './named-path-exists.js';
import { checkNoDuplicateGround } from './no-duplicate-ground.js';
import { checkNoReachIntoSiblingGround } from './no-reach-into-sibling-ground.js';
import { checkNoUnusedGround } from './no-unused-ground.js';
import { checkOneSubjectPerSpec } from './one-subject-per-spec.js';
import { checkSpecInSubjectFolder } from './spec-in-subject-folder.js';

/** The CLI prints this list when a run is clean, so what the reader is told ran is the registry itself. */
export const TREE_PASS_IDS = [
    'database-named-only-when-several',
    'docker-exec-bound-with-await-using',
    'file-suffix-matches-place',
    'no-reach-into-sibling-ground',
    'no-document-in-ground',
    'facet-test-uses-its-runner',
    'facet-folder-has-specification',
    'ground-beside-its-only-reader',
    'seeds-state-absolute-time',
    'no-duplicate-ground',
    'ground-shared-or-inline',
    'one-subject-per-spec',
    'spec-in-subject-folder',
    'named-path-exists',
    'document-env-and-serve-registered',
    'no-unused-ground',
    'no-token-in-request',
    'no-silent-refusal',
    'no-malformed-ref',
    'no-unknown-token',
    'http-first-line-follows-its-grammar',
    'document-streams-written-as-block-scalars',
    'document-keys-in-canonical-order',
    'document-follows-its-grammar',
    'no-volatile-literal',
    'pinned-value-from-the-input',
    'no-empty-expected-stream',
    'document-description-unique',
    'checker-suppression-states-a-reason',
    'document-description-reads-as-a-title',
] as const;

export const MEMBER_PASS_IDS = [
    'file-suffix-matches-place',
    'named-path-exists',
    'no-snapshot-folder',
    'member-has-vitest-config',
    'no-simulated-dom-in-config',
    'no-redundant-test-dependency',
] as const;

/** The registry the catalogue and the E2E inventory derive from, so neither names a pass the CLI does not run. */
export const CHECKER_PASS_IDS: string[] = [
    ...new Set<string>([...TREE_PASS_IDS, ...MEMBER_PASS_IDS]),
];

export type CheckerPassId = (typeof MEMBER_PASS_IDS)[number] | (typeof TREE_PASS_IDS)[number];

export type Finding<PassId extends string = CheckerPassId> = CheckerFinding<PassId>;

export type DocumentFinding = CheckerDocumentFinding<CheckerPassId>;

export function checkerMessage(violation: Finding<string>): string {
    return lessonAt(rowNamed(consumerRows, violation.rule), violation);
}

export function runChecker(rootDir: string): Finding[] {
    return [
        ...checkFileSuffixMatchesPlace(rootDir),
        ...checkFacetFolderHasSpecification(rootDir),
        ...checkFacetTestUsesItsRunner(rootDir),
        ...checkGroundBesideItsOnlyReader(rootDir),
        ...checkCheckerSuppressionStatesAReason(rootDir),
        ...checkGroundAndDocuments(rootDir),
        ...checkDocumentDescriptionUnique(rootDir),
        ...checkNoUnusedGround(rootDir),
        ...checkGroundSharedOrInline(rootDir),
        ...checkOneSubjectPerSpec(rootDir),
        ...checkSpecInSubjectFolder(rootDir),
        ...checkNoDuplicateGround(rootDir),
        ...checkNoReachIntoSiblingGround(rootDir),
        ...checkNamedPathExists(rootDir),
        ...checkDockerExecBoundWithAwaitUsing(rootDir),
        ...checkDatabaseNamedOnlyWhenSeveral(rootDir),
    ];
}

export function checkerLine(violation: Finding<string>): string {
    return reportLine(violation, checkerMessage(violation));
}

export function checkerLines(violations: Finding<string>[]): string {
    return violations.map(checkerLine).join('\n');
}
