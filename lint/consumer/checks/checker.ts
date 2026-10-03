import { CATALOGUE_CHAPTER } from '../../kit/catalogue/chapter.js';
import { fixSpecFiles } from '../../kit/checker/documents.js';
import { walkGround } from '../../kit/checker/ground-walk.js';
import type {
    CheckerRegistry,
    Spotted as CheckerSpotted,
    GroundPasses,
    MemberRead,
} from '../../kit/checker/registry.js';
import type { DocumentFinding as CheckerDocumentFinding } from '../../kit/project/document-model.js';
import { moduleTestsOf } from '../../kit/project/module-tests.js';
import { consumerRows } from '../catalogue/manifest.js';
import { checkAdapterNamedForItsPort } from './adapter-named-for-its-port.js';
import { checkCheckerSuppressionNamesAPass } from './checker-suppression-names-a-pass.js';
import { checkCheckerSuppressionStatesAReason } from './checker-suppression-states-a-reason.js';
import { checkDatabaseNamedOnlyWhenSeveral } from './database-named-only-when-several.js';
import { checkDockerExecBoundWithAwaitUsing } from './docker-exec-bound-with-await-using.js';
import { checkDocumentDescriptionReadsAsATitle } from './document-description-reads-as-a-title.js';
import { checkDocumentDescriptionUnique } from './document-description-unique.js';
import { checkDocumentEnvAndServeRegistered } from './document-env-and-serve-registered.js';
import { checkDocumentFollowsItsGrammar } from './document-follows-its-grammar.js';
import { checkFacetFolderHasSpecification } from './facet-folder-has-specification.js';
import { checkFacetTestUsesItsRunner } from './facet-test-uses-its-runner.js';
import {
    checkFileSuffixMatchesPlace,
    checkFileSuffixMatchesPlaceInMember,
    checkFileSuffixMatchesPlaceOfDocument,
    fixFileSuffixMatchesPlace,
} from './file-suffix-matches-place.js';
import { checkGroundBesideItsOnlyReader } from './ground-beside-its-only-reader.js';
import { checkGroundSharedOrInline, fixGroundSharedOrInline } from './ground-shared-or-inline.js';
import { checkHttpFirstLineFollowsItsGrammar } from './http-first-line-follows-its-grammar.js';
import { checkNamedPathExists, checkNamedPathExistsIn } from './named-path-exists.js';
import { noDocumentInGroundFindings } from './no-document-in-ground.js';
import { checkNoDuplicateGround, fixNoDuplicateGround } from './no-duplicate-ground.js';
import { checkNoEmptyExpectedStream } from './no-empty-expected-stream.js';
import { noMalformedRefFindings } from './no-malformed-ref.js';
import {
    checkNoReachIntoSiblingGround,
    fixNoReachIntoSiblingGround,
} from './no-reach-into-sibling-ground.js';
import { checkNoRedundantTestDependency } from './no-redundant-test-dependency.js';
import { checkNoSilentRefusal } from './no-silent-refusal.js';
import { checkNoSimulatedDomInConfig } from './no-simulated-dom-in-config.js';
import { checkNoSnapshotFolder } from './no-snapshot-folder.js';
import { noTokenInRequestFindings } from './no-token-in-request.js';
import { noUnknownTokenFindings } from './no-unknown-token.js';
import { checkNoUnusedGround } from './no-unused-ground.js';
import { checkNoVolatileLiteral, noVolatileLiteralsInGround } from './no-volatile-literal.js';
import { checkOneSubjectPerSpec } from './one-subject-per-spec.js';
import { checkPinnedValueFromTheInput } from './pinned-value-from-the-input.js';
import { checkReservedFolderInClosedList } from './reserved-folder-in-closed-list.js';
import { checkSeedsStateAbsoluteTime } from './seeds-state-absolute-time.js';
import {
    checkSetupModuleAtLowestCommonFolder,
    fixSetupModuleAtLowestCommonFolder,
} from './setup-module-at-lowest-common-folder.js';
import { checkSpecCodeInSetupFolder } from './spec-code-in-setup-folder.js';
import { checkSpecInSubjectFolder } from './spec-in-subject-folder.js';
import { fixSpecInSubjectFolder } from './spec-in-subject-folder.moves.js';

/** The CLI prints this list when a run is clean, so what the reader is told ran is the registry itself. */
export const TREE_PASS_IDS = [
    'reserved-folder-in-closed-list',
    'spec-code-in-setup-folder',
    'setup-module-at-lowest-common-folder',
    'adapter-named-for-its-port',
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
    'document-follows-its-grammar',
    'no-volatile-literal',
    'pinned-value-from-the-input',
    'no-empty-expected-stream',
    'document-description-unique',
    'checker-suppression-states-a-reason',
    'checker-suppression-names-a-pass',
    'document-description-reads-as-a-title',
] as const;

export const MEMBER_PASS_IDS = [
    'file-suffix-matches-place',
    'named-path-exists',
    'no-snapshot-folder',
    'no-simulated-dom-in-config',
    'no-redundant-test-dependency',
] as const;

/** The registry the catalogue and the E2E inventory derive from, so neither names a pass the CLI does not run. */
export const CHECKER_PASS_IDS: string[] = [
    ...new Set<string>([...TREE_PASS_IDS, ...MEMBER_PASS_IDS]),
];

export type CheckerPassId = (typeof MEMBER_PASS_IDS)[number] | (typeof TREE_PASS_IDS)[number];

export type Spotted<PassId extends string = CheckerPassId> = CheckerSpotted<PassId>;

export type DocumentFinding = CheckerDocumentFinding<CheckerPassId>;

const GROUND: GroundPasses = {
    document: ({ name, rel, text }) => [
        ...noDocumentInGroundFindings(rel, name),
        ...(text === null ? [] : checkDocumentFollowsItsGrammar(text, rel)),
    ],
    // invariant: `no-volatile-literal` reaches ground as well as documents: the same volatile literal in the other half of the tree.
    expected: ({ atTop, name, rel, text }) => [
        ...(atTop && name.endsWith('.http')
            ? checkHttpFirstLineFollowsItsGrammar(rel, name, text, 'response')
            : []),
        ...noUnknownTokenFindings(text, rel),
        ...noMalformedRefFindings(text, rel),
        ...noVolatileLiteralsInGround(rel, text),
    ],
    read: ({ dir, file, rel }) => [
        ...checkFileSuffixMatchesPlaceOfDocument(rel),
        ...checkDocumentDescriptionReadsAsATitle(file.document),
        ...checkNoVolatileLiteral(file.document, dir),
        ...checkPinnedValueFromTheInput(file.document, dir),
        ...checkNoEmptyExpectedStream(file.document),
        ...checkNoSilentRefusal(file.document),
        ...checkDocumentEnvAndServeRegistered(file.document, dir),
    ],
    // invariant: `request-file-extension-known` (oxlint) owns the extension rule.
    request: ({ atTop, name, rel, text }) =>
        name.endsWith('.http')
            ? [
                  ...(atTop ? checkHttpFirstLineFollowsItsGrammar(rel, name, text, 'request') : []),
                  ...noTokenInRequestFindings(rel, text),
              ]
            : [],
    seed: ({ name, path, rel }) => checkSeedsStateAbsoluteTime(path, rel, name),
};

function memberFindings({
    anchored,
    config,
    label,
    manifest,
    memberDir,
    rootDir,
    subject,
}: MemberRead): CheckerSpotted[] {
    return [
        ...(config === null ? [] : checkNoSimulatedDomInConfig(config, rootDir)),
        ...checkNoRedundantTestDependency({ label, manifest, memberDir, subject }),
        // invariant: only a walk of the member sees a `.spec.ts` that never reached a `specs/` tree.
        ...anchored(checkFileSuffixMatchesPlaceInMember(memberDir)),
        ...checkNoSnapshotFolder(memberDir, label),
        // invariant: the tree pass reads the tests under `specs/`.
        ...moduleTestsOf(memberDir).flatMap((test) => checkNamedPathExistsIn(test, rootDir)),
    ];
}

function specFilesRewritten(root: string): string[] {
    const written = fixSpecFiles(root);
    return written.length > 0 ? [`rewrote ${written.length} spec document(s)`] : [];
}

export const CHECKER: CheckerRegistry = {
    chapter: CATALOGUE_CHAPTER,
    fixes: [
        (root) =>
            fixNoReachIntoSiblingGround(root).map(
                (move) => `moved ${move} (no-reach-into-sibling-ground)`,
            ),
        fixFileSuffixMatchesPlace,
        specFilesRewritten,
        (root) =>
            fixSpecInSubjectFolder(root).map(
                (change) => `moved ${change} (one-subject-per-spec, spec-in-subject-folder)`,
            ),
        (root) => fixNoDuplicateGround(root).map((move) => `moved ${move} (no-duplicate-ground)`),
        (root) =>
            fixGroundSharedOrInline(root).map((change) => `${change} (ground-shared-or-inline)`),
        (root) =>
            fixSetupModuleAtLowestCommonFolder(root).map(
                (move) => `moved ${move} (setup-module-at-lowest-common-folder)`,
            ),
    ],
    member: memberFindings,
    memberPassIds: MEMBER_PASS_IDS,
    rows: consumerRows,
    tree: [
        checkReservedFolderInClosedList,
        checkSpecCodeInSetupFolder,
        checkSetupModuleAtLowestCommonFolder,
        checkAdapterNamedForItsPort,
        checkFileSuffixMatchesPlace,
        checkFacetFolderHasSpecification,
        checkFacetTestUsesItsRunner,
        checkGroundBesideItsOnlyReader,
        checkCheckerSuppressionStatesAReason,
        (root) => checkCheckerSuppressionNamesAPass(root, CHECKER_PASS_IDS),
        (root) => walkGround(root, GROUND),
        checkDocumentDescriptionUnique,
        checkNoUnusedGround,
        checkGroundSharedOrInline,
        checkOneSubjectPerSpec,
        checkSpecInSubjectFolder,
        checkNoDuplicateGround,
        checkNoReachIntoSiblingGround,
        checkNamedPathExists,
        checkDockerExecBoundWithAwaitUsing,
        checkDatabaseNamedOnlyWhenSeveral,
    ],
    treePassIds: TREE_PASS_IDS,
};
