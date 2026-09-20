import { asOxlintRule, ruleTester } from '../../rule-tester.fixtures.js';
import { e9wEnvAssignmentInTest } from './e9w-env-assignment-in-test.js';

const TEST_FILE = '/repo/src/domain/order.test.ts';

ruleTester().run('e9w-env-assignment-in-test', asOxlintRule(e9wEnvAssignmentInTest), {
    invalid: [
        // The assignment outlasts the test.
        {
            code: `test('reads the token', () => {
                process.env.API_TOKEN = 'secret';
                expect(read()).toBe('secret');
            });`,
            errors: [{ messageId: 'rawAssignment' }],
            filename: TEST_FILE,
        },
        // The computed form says the same thing.
        {
            code: `test('reads the token', () => {
                process.env['API_TOKEN'] = 'secret';
                expect(read()).toBe('secret');
            });`,
            errors: [{ messageId: 'rawAssignment' }],
            filename: TEST_FILE,
        },
    ],
    valid: [
        // The self-restoring form.
        {
            code: `test('reads the token', () => {
                vi.stubEnv('API_TOKEN', 'secret');
                expect(read()).toBe('secret');
            });`,
            filename: TEST_FILE,
        },
        // Reading is not writing.
        {
            code: `test('reads the token', () => {
                expect(read()).toBe(process.env.API_TOKEN);
            });`,
            filename: TEST_FILE,
        },
        // Out of reach outside a test.
        {
            code: `process.env.API_TOKEN = 'secret';`,
            filename: '/repo/src/domain/order.ts',
        },
    ],
});

ruleTester().run(
    'e9w-env-assignment-in-test — the other two spellings',
    asOxlintRule(e9wEnvAssignmentInTest),
    {
        invalid: [
            // Replacing the whole environment outlasts the test just the same.
            {
                code: `test('reads the token', () => {
                process.env = { ...process.env, API_TOKEN: 'secret' };
                expect(read()).toBe('secret');
            });`,
                errors: [{ messageId: 'rawAssignment' }],
                filename: TEST_FILE,
            },
            // And so does taking a variable away.
            {
                code: `test('reads no token', () => {
                delete process.env.API_TOKEN;
                expect(read()).toBe(undefined);
            });`,
                errors: [{ messageId: 'rawAssignment' }],
                filename: TEST_FILE,
            },
        ],
        valid: [
            // Deleting something else is nobody's business here.
            {
                code: `test('drops the key', () => {
                delete config.token;
                expect(read()).toBe(undefined);
            });`,
                filename: TEST_FILE,
            },
        ],
    },
);
