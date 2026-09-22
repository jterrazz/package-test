import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { a3NoDestructureAlias } from './a3-no-destructure-alias.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

ruleTester.run('a3-no-destructure-alias', a3NoDestructureAlias as unknown as OxlintRule, {
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
