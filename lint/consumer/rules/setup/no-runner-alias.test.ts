import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { noRunnerAlias } from './no-runner-alias.js';

RuleTester.describe = describe;
RuleTester.it = it;

type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

ruleTester.run('no-runner-alias', noRunnerAlias as unknown as OxlintRule, {
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
