import { ruleTester } from '../../../engine/testing/rule-tester.js';
import { cliRunsTheProductBinary } from './cli-runs-the-product-binary.js';

ruleTester().run('cli-runs-the-product-binary', cliRunsTheProductBinary, {
    invalid: [
        // A bare literal pointing into a dependency's installed binary.
        {
            code: "const { cli } = await specification.cli('./node_modules/.bin/oxlint');",
            errors: [{ column: 22, line: 1, messageId: 'thirdPartyBinary' }],
            filename: '/repo/specs/cli/lint.specification.ts',
        },
        // The literal wrapped in a resolve(...) call.
        {
            code: "const { cli } = await specification.cli(resolve(dir, '../../node_modules/.bin/oxfmt'));",
            errors: [{ column: 22, line: 1, messageId: 'thirdPartyBinary' }],
            filename: '/repo/specs/cli/fmt.specification.ts',
        },
        // The idiom real specs use: the bin path hoisted into a const.
        {
            code: "const BIN = resolve(dir, '../../node_modules/.bin/tsc');\nconst { cli } = await specification.cli(BIN);",
            errors: [{ column: 22, line: 2, messageId: 'thirdPartyBinary' }],
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
            code: "const { cli } = await specification.cli('../_fixtures/cli-app/cli.sh');",
            filename: '/repo/specs/cli/cli.specification.ts',
        },
        // Outside a specification file the runner is `runner-in-specification-file`'s to refuse, not this rule's.
        {
            code: "const { cli } = await specification.cli('./node_modules/.bin/oxlint');",
            filename: '/repo/specs/cli/lint/binary.spec.ts',
        },
        // Not a cli() constructor.
        {
            code: 'const { api } = await specification.api({ server });',
            filename: '/repo/specs/api/api.specification.ts',
        },
    ],
});
