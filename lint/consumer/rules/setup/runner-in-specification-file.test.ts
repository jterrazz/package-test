import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { runnerInSpecificationFile } from './runner-in-specification-file.js';

RuleTester.describe = describe;
RuleTester.it = it;

type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

ruleTester.run('runner-in-specification-file', runnerInSpecificationFile as unknown as OxlintRule, {
    invalid: [
        // Constructor call inside a plain spec file.
        {
            code: 'const { cli, cleanup } = await specification.cli("./bin");',
            errors: 1,
            filename: '/repo/specs/cli/exec/exec.test.ts',
        },
        // Any member counts — `runner-in-specification-file` is about the file, `no-unknown-constructor` about the member.
        {
            code: 'await specification.app({});',
            errors: 1,
            filename: '/repo/specs/api/_setup/runner.ts',
        },
    ],
    valid: [
        // The sanctioned home.
        {
            code: 'const { cli, cleanup } = await specification.cli("./bin");',
            filename: '/repo/specs/cli/cli.specification.ts',
        },
        // Unrelated member call on another object.
        {
            code: 'other.cli("./bin");',
            filename: '/repo/specs/cli/exec/exec.test.ts',
        },
    ],
});
