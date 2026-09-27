import type { LintPlugin } from '../../engine/project/rule.js';
import { cliRunsTheProductBinary } from './chain/cli-runs-the-product-binary.js';
import { givenAndThenMarkersPresent } from './chain/given-and-then-markers-present.js';
import { givenInTheTest } from './chain/given-in-the-test.js';
import { markerOnOneLine } from './chain/marker-on-one-line.js';
import { noRedundantServiceUrl } from './chain/no-redundant-service-url.js';
import { noRepeatedChainSetting } from './chain/no-repeated-chain-setting.js';
import { triggerNameInKebabCase } from './chain/trigger-name-in-kebab-case.js';
import { whenBetweenGivenAndThen } from './chain/when-between-given-and-then.js';
import { noExpectInScenario } from './elements/no-expect-in-scenario.js';
import { scenarioEndsSettled } from './elements/scenario-ends-settled.js';
import { testIdStatesWhatIsMissing } from './elements/test-id-states-what-is-missing.js';
import { expectedConstantShared } from './expectations/expected-constant-shared.js';
import { negativeGoldenFrozen } from './expectations/negative-golden-frozen.js';
import { noDoubleOnlyAssertion } from './expectations/no-double-only-assertion.js';
import { noExistenceOnlyAssertion } from './expectations/no-existence-only-assertion.js';
import { noImportedExpectation } from './expectations/no-imported-expectation.js';
import { noProbeCluster } from './expectations/no-probe-cluster.js';
import { noRawBypass } from './expectations/no-raw-bypass.js';
import { noSampledValueInExpectation } from './expectations/no-sampled-value-in-expectation.js';
import { noSingleUseRef } from './expectations/no-single-use-ref.js';
import { noStatusOnlyTest } from './expectations/no-status-only-test.js';
import { noTransformDuplicatingTokens } from './expectations/no-transform-duplicating-tokens.js';
import { resultComparedWhole } from './expectations/result-compared-whole.js';
import { fixturesImportedByTestsOnly } from './imports/fixtures-imported-by-tests-only.js';
import { noSecondTestRuntime } from './imports/no-second-test-runtime.js';
import { noTestCodeInProduction } from './imports/no-test-code-in-production.js';
import { noTestToTestImport } from './imports/no-test-to-test-import.js';
import { noUnpublishedSubpath } from './imports/no-unpublished-subpath.js';
import { goldenPathHasExtension } from './layout/golden-path-has-extension.js';
import { oneDescribePerFile } from './layout/one-describe-per-file.js';
import { pathsNamedInTheTest } from './layout/paths-named-in-the-test.js';
import { requestFileExtensionKnown } from './layout/request-file-extension-known.js';
import { specFileWithinLineLimit } from './layout/spec-file-within-line-limit.js';
import { specNamedForItsAspect } from './layout/spec-named-for-its-aspect.js';
import { specsAtDeclaredDepth } from './layout/specs-at-declared-depth.js';
import { testBesideItsModule } from './layout/test-beside-its-module.js';
import { testBodyWithinLineLimit } from './layout/test-body-within-line-limit.js';
import { verbReadsItsGroundFolder } from './layout/verb-reads-its-ground-folder.js';
import { browserProjectFromComponent } from './setup/browser-project-from-component.js';
import { cleanupPassedToAfterAll } from './setup/cleanup-passed-to-after-all.js';
import { includePointsAtAFolder } from './setup/include-points-at-a-folder.js';
import { literateSpecificationExists } from './setup/literate-specification-exists.js';
import { noDomInModuleTest } from './setup/no-dom-in-module-test.js';
import { noRawEnvWrite } from './setup/no-raw-env-write.js';
import { noRedundantRoot } from './setup/no-redundant-root.js';
import { noRunnerAlias } from './setup/no-runner-alias.js';
import { noSimulatedDom } from './setup/no-simulated-dom.js';
import { noUnknownConstructor } from './setup/no-unknown-constructor.js';
import { projectNamedForItsFacet } from './setup/project-named-for-its-facet.js';
import { runnerInSpecificationFile } from './setup/runner-in-specification-file.js';
import { vitestConfigFromDefineSpecConfig } from './setup/vitest-config-from-define-spec-config.js';
import { noModuleMock } from './world/no-module-mock.js';
import { noSampledValueInTest } from './world/no-sampled-value-in-test.js';
import { noSleep } from './world/no-sleep.js';
import { seedsAreSql } from './world/seeds-are-sql.js';
import { stubDataHasABuilder } from './world/stub-data-has-a-builder.js';
import { stubsImportedThroughFacade } from './world/stubs-imported-through-facade.js';
import { stubsRootHoldsFacadesAndKinds } from './world/stubs-root-holds-facades-and-kinds.js';

/** The `@jterrazz/test` oxlint plugin: `jsPlugins: ['@jterrazz/test/oxlint']`, rules as `jterrazz/<rule>`. Rules import nothing of the runtime, so the bundle stays free of msw, pg and testcontainers. */
const plugin: LintPlugin = {
    meta: { name: 'jterrazz' },
    rules: {
        'runner-in-specification-file': runnerInSpecificationFile,
        'no-unknown-constructor': noUnknownConstructor,
        'no-runner-alias': noRunnerAlias,
        'cleanup-passed-to-after-all': cleanupPassedToAfterAll,
        'no-redundant-root': noRedundantRoot,
        'when-between-given-and-then': whenBetweenGivenAndThen,
        'marker-on-one-line': markerOnOneLine,
        'no-repeated-chain-setting': noRepeatedChainSetting,
        'given-and-then-markers-present': givenAndThenMarkersPresent,
        'no-redundant-service-url': noRedundantServiceUrl,
        'trigger-name-in-kebab-case': triggerNameInKebabCase,
        'cli-runs-the-product-binary': cliRunsTheProductBinary,
        'specs-at-declared-depth': specsAtDeclaredDepth,
        'stubs-imported-through-facade': stubsImportedThroughFacade,
        'stub-data-has-a-builder': stubDataHasABuilder,
        'verb-reads-its-ground-folder': verbReadsItsGroundFolder,
        'paths-named-in-the-test': pathsNamedInTheTest,
        'request-file-extension-known': requestFileExtensionKnown,
        'one-describe-per-file': oneDescribePerFile,
        'spec-named-for-its-aspect': specNamedForItsAspect,
        'spec-file-within-line-limit': specFileWithinLineLimit,
        'test-body-within-line-limit': testBodyWithinLineLimit,
        'stubs-root-holds-facades-and-kinds': stubsRootHoldsFacadesAndKinds,
        'golden-path-has-extension': goldenPathHasExtension,
        'seeds-are-sql': seedsAreSql,
        'no-sampled-value-in-expectation': noSampledValueInExpectation,
        'no-sampled-value-in-test': noSampledValueInTest,
        'no-double-only-assertion': noDoubleOnlyAssertion,
        'no-existence-only-assertion': noExistenceOnlyAssertion,
        'no-probe-cluster': noProbeCluster,
        'result-compared-whole': resultComparedWhole,
        'expected-constant-shared': expectedConstantShared,
        'no-imported-expectation': noImportedExpectation,
        'no-transform-duplicating-tokens': noTransformDuplicatingTokens,
        'no-raw-bypass': noRawBypass,
        'no-single-use-ref': noSingleUseRef,
        'negative-golden-frozen': negativeGoldenFrozen,
        'no-status-only-test': noStatusOnlyTest,
        'vitest-config-from-define-spec-config': vitestConfigFromDefineSpecConfig,
        'project-named-for-its-facet': projectNamedForItsFacet,
        'no-simulated-dom': noSimulatedDom,
        'browser-project-from-component': browserProjectFromComponent,
        'include-points-at-a-folder': includePointsAtAFolder,
        'literate-specification-exists': literateSpecificationExists,
        'no-raw-env-write': noRawEnvWrite,
        'no-unpublished-subpath': noUnpublishedSubpath,
        'no-test-code-in-production': noTestCodeInProduction,
        'no-test-to-test-import': noTestToTestImport,
        'fixtures-imported-by-tests-only': fixturesImportedByTestsOnly,
        'no-second-test-runtime': noSecondTestRuntime,
        'no-dom-in-module-test': noDomInModuleTest,
        'test-beside-its-module': testBesideItsModule,
        'no-module-mock': noModuleMock,
        'no-sleep': noSleep,
        'given-in-the-test': givenInTheTest,
        'no-expect-in-scenario': noExpectInScenario,
        'test-id-states-what-is-missing': testIdStatesWhatIsMissing,
        'scenario-ends-settled': scenarioEndsSettled,
    },
};

export const recommendedRules: Record<string, 'error'> = Object.fromEntries(
    Object.keys(plugin.rules).map((name) => [`jterrazz/${name}`, 'error']),
);

export default plugin;
