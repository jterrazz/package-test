import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { b5AwaitUsing } from './b5-await-using.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

const OPTIONS = [{ runners: ['dockerCli'] }];

ruleTester.run('b5-await-using', b5AwaitUsing as unknown as OxlintRule, {
    invalid: [
        // Plain const binding of a docker-aware result.
        {
            code: 'const result = await dockerCli.exec("spawn");',
            errors: 1,
            options: OPTIONS,
        },
        // Chained setups keep the root runner identifiable.
        {
            code: 'const result = await dockerCli.fixture("$FIXTURES/app/").exec("spawn");',
            errors: 1,
            options: OPTIONS,
        },
    ],
    valid: [
        // The required form.
        { code: 'await using result = await dockerCli.exec("spawn");', options: OPTIONS },
        // Non-docker runners are untouched.
        { code: 'const result = await cli.exec("build");', options: OPTIONS },
        // Without configured runners the rule is inert.
        { code: 'const result = await dockerCli.exec("spawn");' },
    ],
});
