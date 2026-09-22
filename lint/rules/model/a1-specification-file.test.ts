import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { a1SpecificationFile } from './a1-specification-file.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

ruleTester.run('a1-specification-file', a1SpecificationFile as unknown as OxlintRule, {
    invalid: [
        // Constructor call inside a plain spec file.
        {
            code: 'const { cli, cleanup } = await specification.cli("./bin");',
            errors: 1,
            filename: '/repo/specs/cli/exec/exec.test.ts',
        },
        // Any member counts — a1 is about the file, a2 about the member.
        {
            code: 'await specification.app({});',
            errors: 1,
            filename: '/repo/specs/setup/runner.ts',
        },
    ],
    valid: [
        // The sanctioned home.
        {
            code: 'const { cli, cleanup } = await specification.cli("./bin");',
            filename: '/repo/specs/setup/cli.specification.ts',
        },
        // Unrelated member call on another object.
        {
            code: 'other.cli("./bin");',
            filename: '/repo/specs/cli/exec/exec.test.ts',
        },
    ],
});
