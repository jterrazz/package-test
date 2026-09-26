import { i1LayerBoundaries } from './architecture/import-within-declared-layers.js';
import { b9wProductCommand } from './chain/cli-runs-the-product-binary.js';
import { b4GivenThen } from './chain/given-and-then-markers-present.js';
import { j6wGivenInTheTest } from './chain/given-in-the-test.js';
import { b11MarkerOneLine } from './chain/marker-on-one-line.js';
import { b6wRedundantEnvUrl } from './chain/no-redundant-service-url.js';
import { b16wFileContext } from './chain/no-repeated-chain-setting.js';
import { b8KebabTrigger } from './chain/trigger-name-is-kebab-case.js';
import { b10WhenBetweenMarkers } from './chain/when-between-given-and-then.js';
import { w1ScenarioPure } from './elements/no-expect-in-scenario.js';
import { w5wScenarioSettles } from './elements/scenario-ends-settled.js';
import { w2TestIdStatesWhatIsMissing } from './elements/test-id-states-what-is-missing.js';
import { d28SharedExpectation } from './expectations/expected-constant-is-shared.js';
import { d2AwaitIoMatcher } from './expectations/io-matcher-awaited.js';
import { d13wUnfrozenNegativeFixture } from './expectations/negative-golden-frozen.js';
import { d2wAwaitSyncMatcher } from './expectations/no-await-on-sync-matcher.js';
import { d17wDoubleOnlyOracle } from './expectations/no-double-only-assertion.js';
import { d18wExistenceOnlyOracle } from './expectations/no-existence-only-assertion.js';
import { d29NoForeignExpectation } from './expectations/no-imported-expectation.js';
import { d19wProbeCluster } from './expectations/no-probe-cluster.js';
import { d8wRawBypass } from './expectations/no-raw-bypass.js';
import { d16SampledOracle } from './expectations/no-sampled-value-in-expectation.js';
import { d9wSingleUseRef } from './expectations/no-single-use-ref.js';
import { d15wStatusOnlyProbe } from './expectations/no-status-only-test.js';
import { d6wTransformTokenEquivalent } from './expectations/no-transform-duplicating-tokens.js';
import { d20WholeResult } from './expectations/result-compared-whole.js';
import { f5FixturesOnlyFromTests } from './imports/fixtures-imported-by-tests-only.js';
import { f6NoForeignTestRuntime } from './imports/no-second-test-runtime.js';
import { f2NoTestImportsInProd } from './imports/no-test-code-in-production.js';
import { f4NoTestToTestImport } from './imports/no-test-to-test-import.js';
import { f1NoSubpathImport } from './imports/no-unpublished-subpath.js';
import { c6ToMatchExtension } from './layout/golden-path-has-extension.js';
import { c13BareGround } from './layout/ground-uses-reserved-name.js';
import { c31DescribeNamesFile } from './layout/one-describe-per-file.js';
import { c26DiskNamedInTheTest } from './layout/paths-named-in-the-test.js';
import { c2RequestExtension } from './layout/request-file-extension-known.js';
import { c33FileSize } from './layout/spec-file-within-line-limit.js';
import { c32AspectName } from './layout/spec-named-for-its-aspect.js';
import { c1DomainStructure } from './layout/specs-at-declared-depth.js';
import { i2SiblingTestNaming } from './layout/test-beside-its-module.js';
import { c34TestBodySize } from './layout/test-body-within-line-limit.js';
import { c24GroundRole } from './layout/verb-reads-its-ground-folder.js';
import type { LintPlugin } from './rule.js';
import { e6ComponentProjectHelper } from './setup/browser-project-from-component.js';
import { a4CleanupAfterall } from './setup/cleanup-passed-to-after-all.js';
import { e7wIncludePrefixExists } from './setup/include-points-at-a-folder.js';
import { e8LiterateSpecificationExists } from './setup/literate-specification-exists.js';
import { g4NoDomInModuleTest } from './setup/no-dom-in-module-test.js';
import { e9wEnvAssignmentInTest } from './setup/no-raw-env-write.js';
import { a9wRedundantRoot } from './setup/no-redundant-root.js';
import { a3NoDestructureAlias } from './setup/no-runner-alias.js';
import { e5NoSimulatedDom } from './setup/no-simulated-dom.js';
import { a2KnownConstructors } from './setup/no-unknown-constructor.js';
import { e4wProjectBinding } from './setup/project-named-for-its-facet.js';
import { a1SpecificationFile } from './setup/runner-in-specification-file.js';
import { e2PresetConfig } from './setup/vitest-config-from-define-spec-config.js';
import { i4NoModuleDoubles } from './world/no-module-mock.js';
import { d16wAmbientValue } from './world/no-sampled-value-in-test.js';
import { j2NoSleep } from './world/no-sleep.js';
import { c7SeedsSqlOnly } from './world/seeds-are-sql.js';
import { c11StubDataPairing } from './world/stub-data-has-a-builder.js';
import { c10StubsBoundary } from './world/stubs-imported-through-facade.js';
import { c4StubShape } from './world/stubs-root-holds-facades-and-kinds.js';

/** The `@jterrazz/test` oxlint plugin: `jsPlugins: ['@jterrazz/test/oxlint']`, rules as `jterrazz/<rule>`. Rules import nothing of the runtime, so the bundle stays free of msw, pg and testcontainers. */
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
        'b16w-file-context': b16wFileContext,
        'b4-given-then': b4GivenThen,
        'b6w-redundant-env-url': b6wRedundantEnvUrl,
        'b8-kebab-trigger': b8KebabTrigger,
        'b9w-product-command': b9wProductCommand,
        'c1-domain-structure': c1DomainStructure,
        'c10-stubs-boundary': c10StubsBoundary,
        'c11-stub-data-pairing': c11StubDataPairing,
        'c13-bare-ground': c13BareGround,
        'c24-ground-role': c24GroundRole,
        'c26-disk-named-in-the-test': c26DiskNamedInTheTest,
        'c2-request-extension': c2RequestExtension,
        'c31-describe-names-file': c31DescribeNamesFile,
        'c32-aspect-name': c32AspectName,
        'c33-file-size': c33FileSize,
        'c34-test-body-size': c34TestBodySize,
        'c4-stub-shape': c4StubShape,
        'c6-tomatch-extension': c6ToMatchExtension,
        'c7-seeds-sql-only': c7SeedsSqlOnly,
        'd16-sampled-oracle': d16SampledOracle,
        'd16w-ambient-value': d16wAmbientValue,
        'd17w-double-only-oracle': d17wDoubleOnlyOracle,
        'd18w-existence-only-oracle': d18wExistenceOnlyOracle,
        'd19w-probe-cluster': d19wProbeCluster,
        'd20-whole-result': d20WholeResult,
        'd28-shared-expectation': d28SharedExpectation,
        'd29-no-foreign-expectation': d29NoForeignExpectation,
        'd2-await-io-matcher': d2AwaitIoMatcher,
        'd2w-await-sync-matcher': d2wAwaitSyncMatcher,
        'd6w-transform-token-equivalent': d6wTransformTokenEquivalent,
        'd8w-raw-bypass': d8wRawBypass,
        'd9w-single-use-ref': d9wSingleUseRef,
        'd13w-unfrozen-negative-fixture': d13wUnfrozenNegativeFixture,
        'd15w-status-only-probe': d15wStatusOnlyProbe,
        'e2-preset-config': e2PresetConfig,
        'e4w-project-binding': e4wProjectBinding,
        'e5-no-simulated-dom': e5NoSimulatedDom,
        'e6-component-project-helper': e6ComponentProjectHelper,
        'e7w-include-prefix-exists': e7wIncludePrefixExists,
        'e8-literate-specification-exists': e8LiterateSpecificationExists,
        'e9w-env-assignment-in-test': e9wEnvAssignmentInTest,
        'f1-no-subpath-import': f1NoSubpathImport,
        'f2-no-test-imports-in-prod': f2NoTestImportsInProd,
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

/** Every rule at its intended severity: `rules: { ...recommendedRules }`. */
export const recommendedRules: Record<string, 'error' | 'warn'> = Object.fromEntries(
    Object.keys(plugin.rules).map((rule) => [
        `jterrazz/${rule}`,
        /^\w+w-/u.test(rule) ? 'warn' : 'error',
    ]),
);

export default plugin;
