import { ruleTester } from '../../../engine/testing/rule-tester.js';
import { noRunnerAlias } from './no-runner-alias.js';

ruleTester().run('no-runner-alias', noRunnerAlias, {
    invalid: [
        // Renamed facet.
        {
            code: 'const { cli: myCli, cleanup } = await specification.cli("./bin");',
            errors: [{ column: 8, line: 1, messageId: 'aliased' }],
        },
        // Every alias in the pattern is reported.
        {
            code: 'const { api: a, cleanup: stop } = await specification.api({ server });',
            errors: [
                { column: 8, line: 1, messageId: 'aliased' },
                { column: 16, line: 1, messageId: 'aliased' },
            ],
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
