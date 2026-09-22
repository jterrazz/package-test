import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { b9wProductCommand } from './b9w-product-command.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

ruleTester.run('b9w-product-command', b9wProductCommand as unknown as OxlintRule, {
    invalid: [
        // A bare literal pointing into a dependency's installed binary.
        {
            code: "const { cli } = await specification.cli('./node_modules/.bin/oxlint');",
            errors: 1,
            filename: '/repo/specs/cli/lint.specification.ts',
        },
        // The literal wrapped in a resolve(...) call.
        {
            code: "const { cli } = await specification.cli(resolve(dir, '../../node_modules/.bin/oxfmt'));",
            errors: 1,
            filename: '/repo/specs/cli/fmt.specification.ts',
        },
        // The idiom real specs use: the bin path hoisted into a const.
        {
            code: "const BIN = resolve(dir, '../../node_modules/.bin/tsc');\nconst { cli } = await specification.cli(BIN);",
            errors: 1,
            filename: '/repo/specs/cli/tsc.specification.ts',
        },
    ],
    valid: [
        // The product's own command wrapper — the real command under test.
        {
            code: "const { cli } = await specification.cli(resolve(dir, '../bin/typescript.sh'));",
            filename: '/repo/specs/cli/cli.specification.ts',
        },
        // A local fixture binary, not a dependency.
        {
            code: "const { cli } = await specification.cli('../fixtures/cli-app/cli.sh');",
            filename: '/repo/specs/cli/cli.specification.ts',
        },
        // Not a cli() constructor.
        {
            code: 'const { api } = await specification.api({ server });',
            filename: '/repo/specs/api/api.specification.ts',
        },
    ],
});
