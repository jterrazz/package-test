import { asOxlintRule, ruleTester } from '../rule-tester.fixtures.js';
import { j6wGivenInTheTest } from './j6w-given-in-the-test.js';

const TEST_FILE = '/repo/src/domain/order.test.ts';

ruleTester().run('j6w-given-in-the-test', asOxlintRule(j6wGivenInTheTest), {
    invalid: [
        // The Given, above the tests that stand on it.
        {
            code: `beforeEach(() => { order = paid(); });`,
            errors: [{ messageId: 'givenInAHook' }],
            filename: TEST_FILE,
        },
        {
            code: `beforeAll(async () => { server = await start(); });`,
            errors: [{ messageId: 'givenInAHook' }],
            filename: TEST_FILE,
        },
        // A teardown that does more than give back.
        {
            code: `afterEach(() => { vi.restoreAllMocks(); rmSync(directory, { recursive: true }); });`,
            errors: [{ messageId: 'teardownDoesMore' }],
            filename: TEST_FILE,
        },
    ],
    valid: [
        // A teardown that only restores.
        {
            code: `afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });`,
            filename: TEST_FILE,
        },
        // A4's own idiom, in a test file that owns a runner's cleanup.
        { code: `afterAll(cleanup);`, filename: TEST_FILE },
        // The same idiom with a `vi` member: a restore handed over by name.
        { code: `afterEach(vi.restoreAllMocks);`, filename: TEST_FILE },
        { code: `afterEach(vi.useRealTimers);`, filename: TEST_FILE },
        // The Given, in the test.
        {
            code: `test('ships', () => {
                // Given - a paid order
                const order = paid();
                // Then - it leaves
                expect(ship(order)).toBe(true);
            });`,
            filename: TEST_FILE,
        },
        // Out of reach outside a test role.
        { code: `beforeEach(() => { order = paid(); });`, filename: '/repo/src/domain/order.ts' },
    ],
});
