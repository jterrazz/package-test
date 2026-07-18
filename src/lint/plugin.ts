import { a1SpecificationFile } from './rules/a1-specification-file.js';
import { a10DuplicateBinding } from './rules/a10-duplicate-binding.js';
import { a2KnownConstructors } from './rules/a2-known-constructors.js';
import { a3NoDestructureAlias } from './rules/a3-no-destructure-alias.js';
import { a4CleanupAfterall } from './rules/a4-cleanup-afterall.js';
import { a5ModeWithServer } from './rules/a5-mode-with-server.js';
import { a6wRedundantComposeService } from './rules/a6w-redundant-compose-service.js';
import { a9wRedundantRoot } from './rules/a9w-redundant-root.js';
import { b2KnownFixtureMarker } from './rules/b2-known-fixture-marker.js';
import { b4GivenThen } from './rules/b4-given-then.js';
import { b5AwaitUsing } from './rules/b5-await-using.js';
import { b6wRedundantEnvUrl } from './rules/b6w-redundant-env-url.js';
import { b8KebabTrigger } from './rules/b8-kebab-trigger.js';
import { b9wProductCommand } from './rules/b9w-product-command.js';
import { c1DomainStructure } from './rules/c1-domain-structure.js';
import { c2HttpOnlyRequests } from './rules/c2-http-only-requests.js';
import { c4ContractShape } from './rules/c4-contract-shape.js';
import { c6ToMatchExtension } from './rules/c6-tomatch-extension.js';
import { c7SeedsSqlOnly } from './rules/c7-seeds-sql-only.js';
import { c8ReferencedFixtureExists } from './rules/c8-referenced-fixture-exists.js';
import { d12wResponseBodyProbe } from './rules/d12w-response-body-probe.js';
import { d13wUnfrozenNegativeFixture } from './rules/d13w-unfrozen-negative-fixture.js';
import { d15wStatusOnlyProbe } from './rules/d15w-status-only-probe.js';
import { d2AwaitIoMatcher } from './rules/d2-await-io-matcher.js';
import { d2wAwaitSyncMatcher } from './rules/d2w-await-sync-matcher.js';
import { d6wTransformTokenEquivalent } from './rules/d6w-transform-token-equivalent.js';
import { d8wTextBypass } from './rules/d8w-text-bypass.js';
import { d9wSingleUseRef } from './rules/d9w-single-use-ref.js';
import { f1NoSubpathImport } from './rules/f1-no-subpath-import.js';
import { f2NoTestImportsInProd } from './rules/f2-no-test-imports-in-prod.js';
import { f3SpecsPublicEntry } from './rules/f3-specs-public-entry.js';
import { f4NoTestToTestImport } from './rules/f4-no-test-to-test-import.js';
import { f5FixturesOnlyFromTests } from './rules/f5-fixtures-only-from-tests.js';
import { i1LayerBoundaries } from './rules/i1-layer-boundaries.js';
import { i2SiblingTestNaming } from './rules/i2-sibling-test-naming.js';
import { i4NoViMockInSrc } from './rules/i4-no-vi-mock-in-src.js';
import { j1NoOnlySkip } from './rules/j1-no-only-skip.js';
import { j2NoSleepInSpecs } from './rules/j2-no-sleep-in-specs.js';
import { j3NoExpectlessTest } from './rules/j3-no-expectless-test.js';
import { j4UniqueTestNames } from './rules/j4-unique-test-names.js';
import { j5LowercaseTitle } from './rules/j5-lowercase-title.js';
import type { LintPlugin } from './types.js';

/**
 * The `@jterrazz/test` oxlint plugin — the tool-facing lint layer that enforces
 * the statically-checkable CONVENTIONS rules (the `Lint(statique)` catalogue).
 *
 * Registered in a consumer's (or this repo's own) `oxlint.config.ts` via
 * `jsPlugins: ['@jterrazz/test/oxlint']` and referenced as `jterrazz/<rule>` in
 * the `rules` map, e.g. `'jterrazz/j1-no-only-skip': 'error'` — or enabled
 * wholesale by spreading {@link recommendedRules}.
 *
 * This entry is bundled by tsdown (`dist/oxlint.js`); rules import nothing from
 * the framework runtime (only pure core helpers: the token list, the case
 * conversions, the fixture-marker list), so the bundle stays free of the heavy
 * adapters (msw, pg, testcontainers, …) that the main entry pulls in.
 */
const plugin: LintPlugin = {
    meta: { name: 'jterrazz' },
    rules: {
        'a1-specification-file': a1SpecificationFile,
        'a10-duplicate-binding': a10DuplicateBinding,
        'a2-known-constructors': a2KnownConstructors,
        'a3-no-destructure-alias': a3NoDestructureAlias,
        'a4-cleanup-afterall': a4CleanupAfterall,
        'a5-mode-with-server': a5ModeWithServer,
        'a6w-redundant-compose-service': a6wRedundantComposeService,
        'a9w-redundant-root': a9wRedundantRoot,
        'b2-known-fixture-marker': b2KnownFixtureMarker,
        'b4-given-then': b4GivenThen,
        'b5-await-using': b5AwaitUsing,
        'b6w-redundant-env-url': b6wRedundantEnvUrl,
        'b8-kebab-trigger': b8KebabTrigger,
        'b9w-product-command': b9wProductCommand,
        'c1-domain-structure': c1DomainStructure,
        'c2-http-only-requests': c2HttpOnlyRequests,
        'c4-contract-shape': c4ContractShape,
        'c6-tomatch-extension': c6ToMatchExtension,
        'c7-seeds-sql-only': c7SeedsSqlOnly,
        'c8-referenced-fixture-exists': c8ReferencedFixtureExists,
        'd2-await-io-matcher': d2AwaitIoMatcher,
        'd2w-await-sync-matcher': d2wAwaitSyncMatcher,
        'd6w-transform-token-equivalent': d6wTransformTokenEquivalent,
        'd8w-text-bypass': d8wTextBypass,
        'd9w-single-use-ref': d9wSingleUseRef,
        'd12w-response-body-probe': d12wResponseBodyProbe,
        'd13w-unfrozen-negative-fixture': d13wUnfrozenNegativeFixture,
        'd15w-status-only-probe': d15wStatusOnlyProbe,
        'f1-no-subpath-import': f1NoSubpathImport,
        'f2-no-test-imports-in-prod': f2NoTestImportsInProd,
        'f3-specs-public-entry': f3SpecsPublicEntry,
        'f4-no-test-to-test-import': f4NoTestToTestImport,
        'f5-fixtures-only-from-tests': f5FixturesOnlyFromTests,
        'i1-layer-boundaries': i1LayerBoundaries,
        'i2-sibling-test-naming': i2SiblingTestNaming,
        'i4-no-vi-mock-in-src': i4NoViMockInSrc,
        'j1-no-only-skip': j1NoOnlySkip,
        'j2-no-sleep-in-specs': j2NoSleepInSpecs,
        'j3-no-expectless-test': j3NoExpectlessTest,
        'j4-unique-test-names': j4UniqueTestNames,
        'j5-lowercase-title': j5LowercaseTitle,
    },
};

/**
 * The full catalogue at its intended severities — spread into an oxlint
 * `rules` map to enable everything in one line:
 *
 *     rules: { ...recommendedRules }
 *
 * Hard conventions are errors; redundancy heuristics (`<id>w-*` rule ids) are
 * warnings. `b5-await-using` is enabled but inert until re-declared with the
 * project's docker-aware runner names:
 *
 *     'jterrazz/b5-await-using': ['error', { runners: ['dockerCli'] }]
 */
export const recommendedRules: Record<string, 'error' | 'warn'> = Object.fromEntries(
    Object.keys(plugin.rules).map((rule) => [
        `jterrazz/${rule}`,
        /^\w+w-/.test(rule) ? 'warn' : 'error',
    ]),
);

/**
 * The composable testing fragment — wire the plugin, enable the whole
 * catalogue, and ship the one override every strict consumer needs. Designed
 * to be composed with a base preset (e.g. `@jterrazz/typescript/oxlint`):
 *
 *     import { compose, node } from '@jterrazz/typescript/oxlint';
 *     import { testing } from '@jterrazz/test/oxlint';
 *     export default compose(node, testing);
 *
 * `jsPlugins` registers the tool-facing entry; `rules` is {@link recommendedRules};
 * `overrides` relaxes `import/exports-last` for `*.specification.ts` — the A4 idiom
 * (`export const { cli, cleanup } … ; afterAll(cleanup)`) legitimately ends a spec
 * file on a non-export statement, so the relaxation ships here rather than being
 * hand-rolled in every consumer.
 */
export const testing = {
    jsPlugins: ['@jterrazz/test/oxlint'],
    overrides: [
        {
            files: ['**/*.specification.ts'],
            rules: { 'import/exports-last': 'off' },
        },
    ],
    rules: recommendedRules,
};

export default plugin;
