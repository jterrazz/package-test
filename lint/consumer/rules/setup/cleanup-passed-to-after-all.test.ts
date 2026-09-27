import { asOxlintRule, ruleTester } from '../../../engine/testing/rule-tester.fixtures.js';
import { cleanupPassedToAfterAll } from './cleanup-passed-to-after-all.js';

const SPEC_FILE = '/repo/specs/cli/cli.specification.ts';

ruleTester().run('cleanup-passed-to-after-all', asOxlintRule(cleanupPassedToAfterAll), {
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
        // Outside specification files the rule is inert (`runner-in-specification-file` owns that case).
        {
            code: 'const { cli, cleanup } = await specification.cli("./bin");',
            filename: '/repo/specs/cli/exec/exec.test.ts',
        },
    ],
});
