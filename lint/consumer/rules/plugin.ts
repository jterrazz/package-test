import type { LintPlugin } from '../../kit/project/rule.js';
import { cliRunsTheProductBinary } from './chain/cli-runs-the-product-binary.js';
import { givenAndThenMarkersPresent } from './chain/given-and-then-markers-present.js';
import { givenInTheTest } from './chain/given-in-the-test.js';
import { markerOnOneLine } from './chain/marker-on-one-line.js';
import { noRedundantServiceUrl } from './chain/no-redundant-service-url.js';
import { noRepeatedChainSetting } from './chain/no-repeated-chain-setting.js';
import { triggerNameInKebabCase } from './chain/trigger-name-in-kebab-case.js';
import { whenBetweenGivenAndThen } from './chain/when-between-given-and-then.js';
import { noSampledValueInTest } from './clock/no-sampled-value-in-test.js';
import { noSleep } from './clock/no-sleep.js';
import { expectedConstantShared } from './expectations/expected-constant-shared.js';
import { negativeGoldenFrozen } from './expectations/negative-golden-frozen.js';
import { noDoubleOnlyAssertion } from './expectations/no-double-only-assertion.js';
import { noExistenceOnlyAssertion } from './expectations/no-existence-only-assertion.js';
import { noExpectInALoop } from './expectations/no-expect-in-a-loop.js';
import { noExpectOutsideATest } from './expectations/no-expect-outside-a-test.js';
import { noImportedExpectation } from './expectations/no-imported-expectation.js';
import { noProbeCluster } from './expectations/no-probe-cluster.js';
import { noRawBypass } from './expectations/no-raw-bypass.js';
import { noSampledValueInExpectation } from './expectations/no-sampled-value-in-expectation.js';
import { noSingleUseRef } from './expectations/no-single-use-ref.js';
import { noStatusOnlyTest } from './expectations/no-status-only-test.js';
import { noTransformDuplicatingTokens } from './expectations/no-transform-duplicating-tokens.js';
import { resultComparedWhole } from './expectations/result-compared-whole.js';
import { noTestCodeInProduction } from './imports/no-test-code-in-production.js';
import { goldenPathHasExtension } from './layout/golden-path-has-extension.js';
import { oneDescribePerFile } from './layout/one-describe-per-file.js';
import { pathsNamedInTheTest } from './layout/paths-named-in-the-test.js';
import { requestFileExtensionKnown } from './layout/request-file-extension-known.js';
import { specFileWithinLineLimit } from './layout/spec-file-within-line-limit.js';
import { specNamedForItsAspect } from './layout/spec-named-for-its-aspect.js';
import { specsAtDeclaredDepth } from './layout/specs-at-declared-depth.js';
import { testBodyWithinLineLimit } from './layout/test-body-within-line-limit.js';
import { testInItsTestsFolder } from './layout/test-in-its-tests-folder.js';
import { verbReadsItsGroundFolder } from './layout/verb-reads-its-ground-folder.js';
import { noModuleMock } from './mocks/no-module-mock.js';
import { seedsAreSql } from './services/seeds-are-sql.js';
import { cleanupPassedToAfterAll } from './setup/cleanup-passed-to-after-all.js';
import { includePointsAtAFolder } from './setup/include-points-at-a-folder.js';
import { literateRunnerExists } from './setup/literate-runner-exists.js';
import { noDomInModuleTest } from './setup/no-dom-in-module-test.js';
import { noRawEnvWrite } from './setup/no-raw-env-write.js';
import { noRedundantRoot } from './setup/no-redundant-root.js';
import { noRunnerAlias } from './setup/no-runner-alias.js';
import { noSimulatedDom } from './setup/no-simulated-dom.js';
import { noUnknownConstructor } from './setup/no-unknown-constructor.js';
import { runnerInSpecificationFile } from './setup/runner-in-specification-file.js';
import { stubDataHasABuilder } from './stubs/stub-data-has-a-builder.js';
import { stubsImportedThroughFacade } from './stubs/stubs-imported-through-facade.js';
import { stubsRootHoldsFacadesAndKinds } from './stubs/stubs-root-holds-facades-and-kinds.js';
import { noExpectInScenario } from './visitor/no-expect-in-scenario.js';
import { scenarioEndsSettled } from './visitor/scenario-ends-settled.js';
import { testIdStatesWhatIsMissing } from './visitor/test-id-states-what-is-missing.js';

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
        'no-expect-in-a-loop': noExpectInALoop,
        'no-expect-outside-a-test': noExpectOutsideATest,
        'no-probe-cluster': noProbeCluster,
        'result-compared-whole': resultComparedWhole,
        'expected-constant-shared': expectedConstantShared,
        'no-imported-expectation': noImportedExpectation,
        'no-transform-duplicating-tokens': noTransformDuplicatingTokens,
        'no-raw-bypass': noRawBypass,
        'no-single-use-ref': noSingleUseRef,
        'negative-golden-frozen': negativeGoldenFrozen,
        'no-status-only-test': noStatusOnlyTest,
        'no-simulated-dom': noSimulatedDom,
        'include-points-at-a-folder': includePointsAtAFolder,
        'literate-runner-exists': literateRunnerExists,
        'no-raw-env-write': noRawEnvWrite,
        'no-test-code-in-production': noTestCodeInProduction,
        'no-dom-in-module-test': noDomInModuleTest,
        'test-in-its-tests-folder': testInItsTestsFolder,
        'no-module-mock': noModuleMock,
        'no-sleep': noSleep,
        'given-in-the-test': givenInTheTest,
        'no-expect-in-scenario': noExpectInScenario,
        'test-id-states-what-is-missing': testIdStatesWhatIsMissing,
        'scenario-ends-settled': scenarioEndsSettled,
    },
};

export default plugin;
