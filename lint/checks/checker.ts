import { lessonOf } from '../catalogue/lesson.js';
import type { Teaching } from '../catalogue/lesson.js';
import { checkSuppressionReason } from './checker-suppression-states-a-reason.js';
import { checkDatabaseProperty } from './database-named-only-when-several.js';
import { checkDockerRunnerAwaitUsing } from './docker-exec-bound-with-await-using.js';
import { checkSpecDescriptionsUnique } from './document-description-unique.js';
import { checkFacetFolder } from './facet-folder-has-specification.js';
import { checkModuleTestUnderFacet } from './facet-test-uses-its-runner.js';
import { checkTestUnderFacet } from './file-suffix-matches-place.js';
import { checkGroundOwnedByOne } from './ground-beside-its-only-reader.js';
import { checkConventionFiles } from './ground-files.js';
import { checkGroundSharing } from './ground-shared-or-inline.js';
import { checkDiskTargetsExist } from './named-path-exists.js';
import { checkCopiedGround } from './no-duplicate-ground.js';
import { checkLocalFixtureReach } from './no-reach-into-sibling-ground.js';
import { checkDeadFixtures } from './no-unused-ground.js';
import { checkOneSubject } from './one-subject-per-spec.js';
import { checkSubjectFolder } from './spec-in-subject-folder.js';

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

export type Severity = 'error' | 'warn';

export type TokenViolation<PassId extends string = CheckerPassId> = Teaching & {
    /** A finding about a whole file or folder points at its first column. */
    column?: number;
    file: string;
    line: number;
    /** Published as `jterrazz-check(<code>)`, counted by the ratchet under `jterrazz-check/<code>`. */
    rule: PassId;
    severity: Severity;
    token?: string;
};

export function messageOf(violation: TokenViolation<string>): string {
    return lessonOf(violation.rule, violation);
}

export function runAllChecks(rootDir: string): TokenViolation[] {
    return [
        ...checkTestUnderFacet(rootDir),
        ...checkFacetFolder(rootDir),
        ...checkModuleTestUnderFacet(rootDir),
        ...checkGroundOwnedByOne(rootDir),
        ...checkSuppressionReason(rootDir),
        ...checkConventionFiles(rootDir),
        ...checkSpecDescriptionsUnique(rootDir),
        ...checkDeadFixtures(rootDir),
        ...checkGroundSharing(rootDir),
        ...checkOneSubject(rootDir),
        ...checkSubjectFolder(rootDir),
        ...checkCopiedGround(rootDir),
        ...checkLocalFixtureReach(rootDir),
        ...checkDiskTargetsExist(rootDir),
        ...checkDockerRunnerAwaitUsing(rootDir),
        ...checkDatabaseProperty(rootDir),
    ];
}

/** The compiler convention every editor's problem matcher parses, and oxlint's findings normalise to. */
export function reportLine(violation: TokenViolation<string>, message: string): string {
    const { column, file, line, rule, severity } = violation;
    const level = severity === 'error' ? 'error' : 'warning';
    return `${file}:${line}:${column ?? 1}: ${level} jterrazz-check(${rule}): ${message}`;
}

export function formatViolation(violation: TokenViolation<string>): string {
    return reportLine(violation, messageOf(violation));
}

export function formatViolations(violations: TokenViolation<string>[]): string {
    return violations.map(formatViolation).join('\n');
}
