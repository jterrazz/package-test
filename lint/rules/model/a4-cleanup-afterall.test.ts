import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { a4CleanupAfterall } from './a4-cleanup-afterall.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

const SPEC_FILE = '/repo/specs/setup/cli.specification.ts';

ruleTester.run('a4-cleanup-afterall', a4CleanupAfterall as unknown as OxlintRule, {
    invalid: [
        // Destructured but never registered.
        {
            code: 'const { cli, cleanup } = await specification.cli("./bin");',
            errors: 1,
            filename: SPEC_FILE,
        },
        // An afterAll without cleanup does not count.
        {
            code: `const { cli, cleanup } = await specification.cli("./bin");
                afterAll(() => other());`,
            errors: 1,
            filename: SPEC_FILE,
        },
    ],
    valid: [
        // Direct registration.
        {
            code: `const { cli, cleanup } = await specification.cli("./bin");
                afterAll(cleanup);`,
            filename: SPEC_FILE,
        },
        // Registration inside a callback.
        {
            code: `const { cli, cleanup } = await specification.cli("./bin");
                afterAll(async () => { await cleanup(); });`,
            filename: SPEC_FILE,
        },
        // No cleanup destructured — nothing to register.
        {
            code: 'const { cli } = await specification.cli("./bin");',
            filename: SPEC_FILE,
        },
        // Outside specification files the rule is inert (A1 owns that case).
        {
            code: 'const { cli, cleanup } = await specification.cli("./bin");',
            filename: '/repo/specs/cli/exec/exec.test.ts',
        },
    ],
});
