import { ruleTester } from '@jterrazz/test';

import { cleanupPassedToAfterAll } from './cleanup-passed-to-after-all.js';

const SPEC_FILE = '/repo/specs/cli/cli.specification.ts';

ruleTester().run('cleanup-passed-to-after-all', cleanupPassedToAfterAll, {
    invalid: [
        {
            name: 'Destructured but never registered.',
            code: 'const { cli, cleanup } = await specification.cli("./bin");',
            errors: [{ column: 6, line: 1, messageId: 'unregistered' }],
            filename: SPEC_FILE,
        },
        {
            name: 'An afterAll without cleanup does not count.',
            code: `const { cli, cleanup } = await specification.cli("./bin");
                afterAll(() => other());`,
            errors: [{ column: 6, line: 1, messageId: 'unregistered' }],
            filename: SPEC_FILE,
        },
    ],
    valid: [
        {
            name: 'Direct registration.',
            code: `const { cli, cleanup } = await specification.cli("./bin");
                afterAll(cleanup);`,
            filename: SPEC_FILE,
        },
        {
            name: 'Registration inside a callback.',
            code: `const { cli, cleanup } = await specification.cli("./bin");
                afterAll(async () => { await cleanup(); });`,
            filename: SPEC_FILE,
        },
        {
            name: 'No cleanup destructured — nothing to register.',
            code: 'const { cli } = await specification.cli("./bin");',
            filename: SPEC_FILE,
        },
        {
            name: 'Outside specification files the rule is inert (`runner-in-specification-file` owns that case).',
            code: 'const { cli, cleanup } = await specification.cli("./bin");',
            filename: '/repo/specs/cli/exec/exec.test.ts',
        },
    ],
});
