import { asOxlintRule, ruleTester } from '../../../engine/testing/rule-tester.fixtures.js';
import { noRunnerAlias } from './no-runner-alias.js';

ruleTester().run('no-runner-alias', asOxlintRule(noRunnerAlias), {
    invalid: [
        // Renamed facet.
        {
            code: 'const { cli: myCli, cleanup } = await specification.cli("./bin");',
            errors: 1,
        },
        // Every alias in the pattern is reported.
        {
            code: 'const { api: a, cleanup: stop } = await specification.api({ server });',
            errors: 2,
        },
    ],
    valid: [
        // Canonical names.
        { code: 'const { cli, cleanup, docker } = await specification.cli("./bin");' },
        // Aliasing an unrelated call is out of scope.
        { code: 'const { a: b } = await other.cli("./bin");' },
        // Rest element is fine.
        { code: 'const { cli, ...rest } = await specification.cli("./bin");' },
    ],
});
