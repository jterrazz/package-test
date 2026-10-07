import { ruleTester } from '@jterrazz/test';

import { givenInTheTest } from '../given-in-the-test.js';

const TEST_FILE = '/repo/src/domain/order.test.ts';

ruleTester().run('given-in-the-test', givenInTheTest, {
    invalid: [
        {
            name: 'The Given, above the tests that stand on it.',
            code: `beforeEach(() => { order = paid(); });`,
            errors: [{ column: 0, line: 1, messageId: 'givenInAHook' }],
            filename: TEST_FILE,
        },
        {
            code: `beforeAll(async () => { server = await start(); });`,
            errors: [{ column: 0, line: 1, messageId: 'givenInAHook' }],
            filename: TEST_FILE,
        },
    ],
    valid: [
        {
            name: 'A teardown gives back what the tests took: a temp directory, a server, a restore.',
            code: `afterAll(() => { rmSync(tmp, { force: true, recursive: true }); });`,
            filename: TEST_FILE,
        },
        { code: `afterEach(async () => server.stop());`, filename: TEST_FILE },
        {
            code: `afterEach(() => { vi.restoreAllMocks(); rmSync(directory, { recursive: true }); });`,
            filename: TEST_FILE,
        },
        {
            code: `afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });`,
            filename: TEST_FILE,
        },
        {
            name: "`cleanup-passed-to-after-all`'s own idiom, in a test file that owns a runner's cleanup.",
            code: `afterAll(cleanup);`,
            filename: TEST_FILE,
        },
        {
            name: 'The same idiom with a `vi` member: a restore handed over by name.',
            code: `afterEach(vi.restoreAllMocks);`,
            filename: TEST_FILE,
        },
        { code: `afterEach(vi.useRealTimers);`, filename: TEST_FILE },
        {
            name: 'The Given, in the test.',
            code: `test('ships', () => {
                // Given - a paid order
                const order = paid();
                // Then - it leaves
                expect(ship(order)).toBe(true);
            });`,
            filename: TEST_FILE,
        },
        {
            name: 'Out of reach outside a test role.',
            code: `beforeEach(() => { order = paid(); });`,
            filename: '/repo/src/domain/order.ts',
        },
    ],
});
