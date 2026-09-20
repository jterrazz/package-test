/*
 * The config type is oxlint's own, reached through `@jterrazz/typescript` —
 * the one devDependency a consumer of this toolchain declares. Stating it here
 * is what makes `compose(<profile>, testing)` type-check with no assertion: an
 * inferred `rules` widens every severity to `string`, which oxlint's closed
 * union refuses.
 */
import type { OxlintConfig } from '@jterrazz/typescript/oxlint';

import { anchorOf } from './rule-code.js';
import { a1SpecificationFile } from './rules/a1-specification-file.js';
import { a2KnownConstructors } from './rules/a2-known-constructors.js';
import { a3NoDestructureAlias } from './rules/a3-no-destructure-alias.js';
import { a4CleanupAfterall } from './rules/a4-cleanup-afterall.js';
import { a9wRedundantRoot } from './rules/a9w-redundant-root.js';
import { b2KnownFixtureMarker } from './rules/b2-known-fixture-marker.js';
import { b4GivenThen } from './rules/b4-given-then.js';
import { b6wRedundantEnvUrl } from './rules/b6w-redundant-env-url.js';
import { b8KebabTrigger } from './rules/b8-kebab-trigger.js';
import { b9wProductCommand } from './rules/b9w-product-command.js';
import { b10WhenBetweenMarkers } from './rules/b10-when-between-markers.js';
import { b11MarkerOneLine } from './rules/b11-marker-one-line.js';
import { c1DomainStructure } from './rules/c1-domain-structure.js';
import { c2HttpOnlyRequests } from './rules/c2-http-only-requests.js';
import { c4ContractShape } from './rules/c4-contract-shape.js';
import { c6ToMatchExtension } from './rules/c6-tomatch-extension.js';
import { c7SeedsSqlOnly } from './rules/c7-seeds-sql-only.js';
import { c8ReferencedFixtureExists } from './rules/c8-referenced-fixture-exists.js';
import { c10ContractsBoundary } from './rules/c10-contracts-boundary.js';
import { c11ContractDataPairing } from './rules/c11-contract-data-pairing.js';
import { c13UnderscoredGround } from './rules/c13-underscored-ground.js';
import { d2AwaitIoMatcher } from './rules/d2-await-io-matcher.js';
import { d2wAwaitSyncMatcher } from './rules/d2w-await-sync-matcher.js';
import { d6wTransformTokenEquivalent } from './rules/d6w-transform-token-equivalent.js';
import { d8wTextBypass } from './rules/d8w-text-bypass.js';
import { d9wSingleUseRef } from './rules/d9w-single-use-ref.js';
import { d12wResponseBodyProbe } from './rules/d12w-response-body-probe.js';
import { d13wUnfrozenNegativeFixture } from './rules/d13w-unfrozen-negative-fixture.js';
import { d15wStatusOnlyProbe } from './rules/d15w-status-only-probe.js';
import { d16SampledOracle } from './rules/d16-sampled-oracle.js';
import { d16wAmbientValue } from './rules/d16w-ambient-value.js';
import { d17wDoubleOnlyOracle } from './rules/d17w-double-only-oracle.js';
import { d18wExistenceOnlyOracle } from './rules/d18w-existence-only-oracle.js';
import { d19wProbeCluster } from './rules/d19w-probe-cluster.js';
import { e2PresetConfig } from './rules/e2-preset-config.js';
import { e4wProjectBinding } from './rules/e4w-project-binding.js';
import { e5NoSimulatedDom } from './rules/e5-no-simulated-dom.js';
import { e5bNoSimulatedDomConfig } from './rules/e5b-no-simulated-dom-config.js';
import { e6ComponentProjectHelper } from './rules/e6-component-project-helper.js';
import { e7wIncludePrefixExists } from './rules/e7w-include-prefix-exists.js';
import { e8LiterateSpecificationExists } from './rules/e8-literate-specification-exists.js';
import { e9wEnvAssignmentInTest } from './rules/e9w-env-assignment-in-test.js';
import { f1NoSubpathImport } from './rules/f1-no-subpath-import.js';
import { f2NoTestImportsInProd } from './rules/f2-no-test-imports-in-prod.js';
import { f3SpecsPublicEntry } from './rules/f3-specs-public-entry.js';
import { f4NoTestToTestImport } from './rules/f4-no-test-to-test-import.js';
import { f5FixturesOnlyFromTests } from './rules/f5-fixtures-only-from-tests.js';
import { f6NoForeignTestRuntime } from './rules/f6-no-foreign-test-runtime.js';
import { g4NoDomInModuleTest } from './rules/g4-no-dom-in-module-test.js';
import { i1LayerBoundaries } from './rules/i1-layer-boundaries.js';
import { i2SiblingTestNaming } from './rules/i2-sibling-test-naming.js';
import { i4NoModuleDoubles } from './rules/i4-no-module-doubles.js';
import { j2NoSleep } from './rules/j2-no-sleep.js';
import { j6wGivenInTheTest } from './rules/j6w-given-in-the-test.js';
import { w1ScenarioPure } from './rules/w1-scenario-pure.js';
import { w2TestIdStatesWhatIsMissing } from './rules/w2-testid-states-what-is-missing.js';
import { w5wScenarioSettles } from './rules/w5w-scenario-settles.js';
import type { LintPlugin, LintRule } from './types.js';

/**
 * The `@jterrazz/test` oxlint plugin — the tool-facing lint layer that enforces
 * the statically-checkable CONVENTIONS rules (the `Lint(statique)` catalogue).
 *
 * Registered in a consumer's (or this repo's own) `oxlint.config.ts` via
 * `jsPlugins: ['@jterrazz/test/oxlint']` and referenced as `jterrazz/<rule>` in
 * the `rules` map, e.g. `'jterrazz/j2-no-sleep': 'error'` — or enabled
 * wholesale by spreading {@link recommendedRules}.
 *
 * This entry is bundled by tsdown (`dist/oxlint.js`); rules import nothing from
 * the framework runtime (only pure core helpers: the token list, the case
 * conversions, the fixture-marker list), so the bundle stays free of the heavy
 * adapters (msw, pg, testcontainers, …) that the main entry pulls in.
 */
/**
 * Give every message of a rule its generated tail — `(I2 — docs/…#i2-…)`.
 *
 * The anchor is the only route most readers ever take into the catalogue, and
 * it carries the id they cite in a suppression. Generated here rather than
 * typed into each message: forty-odd hand-written tails drifted from the
 * chapter the first time one heading moved, and nothing failed when they did.
 */
function anchored(name: string, rule: LintRule): LintRule {
    const { messages } = rule.meta ?? {};
    const id = rule.meta?.docs?.id;
    if (messages === undefined || id === undefined) {
        return rule;
    }
    const tail = anchorOf(id, name);
    const routed = Object.fromEntries(
        Object.entries(messages).map(([key, text]) => [key, `${text} ${tail}`]),
    );
    return { ...rule, meta: { ...rule.meta, messages: routed } };
}

/** Every shipped rule, each with the anchor its diagnostics end on. */
function withAnchors(rules: Record<string, LintRule>): Record<string, LintRule> {
    return Object.fromEntries(
        Object.entries(rules).map(([name, rule]) => [name, anchored(name, rule)]),
    );
}

const plugin: LintPlugin = {
    meta: { name: 'jterrazz' },
    rules: {
        'a1-specification-file': a1SpecificationFile,
        'a2-known-constructors': a2KnownConstructors,
        'a3-no-destructure-alias': a3NoDestructureAlias,
        'a4-cleanup-afterall': a4CleanupAfterall,
        'a9w-redundant-root': a9wRedundantRoot,
        'b10-when-between-markers': b10WhenBetweenMarkers,
        'b11-marker-one-line': b11MarkerOneLine,
        'b2-known-fixture-marker': b2KnownFixtureMarker,
        'b4-given-then': b4GivenThen,
        'b6w-redundant-env-url': b6wRedundantEnvUrl,
        'b8-kebab-trigger': b8KebabTrigger,
        'b9w-product-command': b9wProductCommand,
        'c1-domain-structure': c1DomainStructure,
        'c10-contracts-boundary': c10ContractsBoundary,
        'c11-contract-data-pairing': c11ContractDataPairing,
        'c13-underscored-ground': c13UnderscoredGround,
        'c2-http-only-requests': c2HttpOnlyRequests,
        'c4-contract-shape': c4ContractShape,
        'c6-tomatch-extension': c6ToMatchExtension,
        'c7-seeds-sql-only': c7SeedsSqlOnly,
        'c8-referenced-fixture-exists': c8ReferencedFixtureExists,
        'd16-sampled-oracle': d16SampledOracle,
        'd16w-ambient-value': d16wAmbientValue,
        'd17w-double-only-oracle': d17wDoubleOnlyOracle,
        'd18w-existence-only-oracle': d18wExistenceOnlyOracle,
        'd19w-probe-cluster': d19wProbeCluster,
        'd2-await-io-matcher': d2AwaitIoMatcher,
        'd2w-await-sync-matcher': d2wAwaitSyncMatcher,
        'd6w-transform-token-equivalent': d6wTransformTokenEquivalent,
        'd8w-text-bypass': d8wTextBypass,
        'd9w-single-use-ref': d9wSingleUseRef,
        'd12w-response-body-probe': d12wResponseBodyProbe,
        'd13w-unfrozen-negative-fixture': d13wUnfrozenNegativeFixture,
        'd15w-status-only-probe': d15wStatusOnlyProbe,
        'e2-preset-config': e2PresetConfig,
        'e4w-project-binding': e4wProjectBinding,
        'e5-no-simulated-dom': e5NoSimulatedDom,
        'e5b-no-simulated-dom-config': e5bNoSimulatedDomConfig,
        'e6-component-project-helper': e6ComponentProjectHelper,
        'e7w-include-prefix-exists': e7wIncludePrefixExists,
        'e8-literate-specification-exists': e8LiterateSpecificationExists,
        'e9w-env-assignment-in-test': e9wEnvAssignmentInTest,
        'f1-no-subpath-import': f1NoSubpathImport,
        'f2-no-test-imports-in-prod': f2NoTestImportsInProd,
        'f3-specs-public-entry': f3SpecsPublicEntry,
        'f4-no-test-to-test-import': f4NoTestToTestImport,
        'f5-fixtures-only-from-tests': f5FixturesOnlyFromTests,
        'f6-no-foreign-test-runtime': f6NoForeignTestRuntime,
        'g4-no-dom-in-module-test': g4NoDomInModuleTest,
        'i1-layer-boundaries': i1LayerBoundaries,
        'i2-sibling-test-naming': i2SiblingTestNaming,
        'i4-no-module-doubles': i4NoModuleDoubles,
        'j2-no-sleep': j2NoSleep,
        'j6w-given-in-the-test': j6wGivenInTheTest,
        'w1-scenario-pure': w1ScenarioPure,
        'w2-testid-states-what-is-missing': w2TestIdStatesWhatIsMissing,
        'w5w-scenario-settles': w5wScenarioSettles,
    },
};

// The published plugin is the one whose messages carry their anchor.
const routedPlugin: LintPlugin = { ...plugin, rules: withAnchors(plugin.rules) };

/**
 * The full catalogue at its intended severities — spread into an oxlint
 * `rules` map to enable everything in one line:
 *
 *     rules: { ...recommendedRules }
 *
 * Hard conventions are errors; redundancy heuristics (`<id>w-*` rule ids) are
 * warnings.
 */
export const recommendedRules: Record<string, 'error' | 'warn'> = Object.fromEntries(
    Object.keys(plugin.rules).map((rule) => [
        `jterrazz/${rule}`,
        /^\w+w-/u.test(rule) ? 'warn' : 'error',
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
 * `jsPlugins` registers the tool-facing entry; `rules` is {@link recommendedRules}
 * plus the UPSTREAM options this vocabulary owns; `overrides` relaxes
 * `import/exports-last` for `*.specification.ts` — the A4 idiom
 * (`export const { cli, cleanup } … ; afterAll(cleanup)`) legitimately ends a spec
 * file on a non-export statement, so the relaxation ships here rather than being
 * hand-rolled in every consumer.
 *
 * An upstream rule that can carry a convention as an OPTION is set here rather
 * than duplicated as a `jterrazz/*` rule: one owner per convention. The file
 * naming is the first of them — the fork spends two suffixes (`.test.ts(x)`
 * beside the code, `.spec.ts` under `specs/`), and the plugin's default pattern
 * knows only the first, so a facet spec would be refused for wearing the word
 * C12 requires of it.
 *
 * It is set in an OVERRIDE, not in `rules`, because that is where the option
 * survives: a base profile turns the vitest plugin on inside an override over
 * the test globs, and an override's entry REPLACES a top-level one rather than
 * merging with it. A fragment that wrote the option at the top level would be
 * silently overruled by whichever profile it was composed with.
 */

/** The globs an upstream test rule is set over — the three suffixes, and a specs tree. */
const TEST_GLOBS = ['**/*.{test,spec,test-d,spec-d}.{ts,tsx,js,jsx}', '**/specs/**/*.{ts,tsx}'];

/**
 * D20 — the seven matchers vitest offers for snapshots, each pointed back at
 * the one golden mechanism this vocabulary has.
 *
 * A snapshot is written by the run that was supposed to be judged by it: the
 * file lands beside the test, nobody reads the diff, and a wrong answer becomes
 * the expectation the moment someone re-records. `toMatch('<name>.<ext>')`
 * under `_expected/` is the same convenience with the file where a reviewer
 * looks, tokens for what legitimately moves, and `TEST_UPDATE=1` as the one
 * door that rewrites it.
 */
const SNAPSHOT_MATCHERS: Record<string, string> = {
    toMatchAriaSnapshot:
        "The ARIA tree is a golden: `expect(result.tree).toMatch('<case>.aria.yaml')`.",
    toMatchFileSnapshot: "Name the file yourself: `expect(subject).toMatch('<case>.<ext>')`.",
    toMatchInlineSnapshot:
        "An inline snapshot is the run judging itself: `expect(subject).toMatch('<case>.<ext>')`, or compare to a literal with `toStrictEqual`.",
    toMatchScreenshot:
        'A screenshot is not a golden this dialect can read: assert the ARIA tree, the content, or the markup.',
    toMatchSnapshot:
        "The golden is `expect(subject).toMatch('<name>.<ext>')` under `_expected/`; under `src/` compare to a literal with `toStrictEqual`.",
    toThrowErrorMatchingInlineSnapshot:
        "State the message: `expect(fn).toThrow('<what the subject says>')`.",
    toThrowErrorMatchingSnapshot:
        "State the message: `expect(fn).toThrow('<what the subject says>')`.",
};

/**
 * M3 — the four `vi` methods that take a seam this vocabulary owns.
 *
 * `stubGlobal` replaces the network with a function the test wrote; the three
 * timer methods take the clock without giving it back at the end of the scope.
 * `stubEnv` is NOT here: it restores itself and is the sanctioned way to state
 * an env a module reads. `vi.mock`/`vi.doMock` stay on I4, whose allow-list the
 * option cannot express.
 */
const RESTRICTED_VI_METHODS: Record<string, string> = {
    setSystemTime: '`vi.setSystemTime` → `clock.at(iso)`, which gives the calendar back.',
    stubGlobal: "`vi.stubGlobal('fetch')` → `await using _ = await intercept(defineContracts(…))`.",
    useFakeTimers: '`vi.useFakeTimers` → `clock.at(iso)` and `clock.advance(ms)`.',
    useRealTimers: '`vi.useRealTimers` → nothing: `using` gives the clock back at the scope end.',
};

export const testing: OxlintConfig = {
    jsPlugins: ['@jterrazz/test/oxlint'],
    overrides: [
        {
            files: ['**/*.specification.ts'],
            rules: { 'import/exports-last': 'off' },
        },
        {
            files: TEST_GLOBS,
            rules: {
                'vitest/consistent-test-filename': [
                    'error',
                    { pattern: String.raw`.*\.(?:test|spec)\.[tj]sx?$` },
                ],
                // J10 — one level of `describe` groups a file; a second is a
                // Tree of contexts a reader has to hold in their head, and the
                // Name of the test stops being the sentence it was.
                'vitest/max-nested-describe': ['error', { max: 1 }],
                'vitest/no-restricted-matchers': ['error', SNAPSHOT_MATCHERS],
                'vitest/no-restricted-vi-methods': ['error', RESTRICTED_VI_METHODS],
            },
        },
    ],
    rules: recommendedRules,
};

export default routedPlugin;
