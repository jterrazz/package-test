import { ruleTester } from '@jterrazz/test';

import { noRawEnvWrite } from './no-raw-env-write.js';

const TEST_FILE = '/repo/src/domain/order.test.ts';

ruleTester().run('no-raw-env-write', noRawEnvWrite, {
    invalid: [
        {
            name: 'The assignment outlasts the test.',
            code: `test('reads the token', () => {
                process.env.API_TOKEN = 'secret';
                expect(read()).toBe('secret');
            });`,
            errors: [{ column: 16, line: 2, messageId: 'rawAssignment' }],
            filename: TEST_FILE,
        },
        {
            name: 'The computed form says the same thing.',
            code: `test('reads the token', () => {
                process.env['API_TOKEN'] = 'secret';
                expect(read()).toBe('secret');
            });`,
            errors: [{ column: 16, line: 2, messageId: 'rawAssignment' }],
            filename: TEST_FILE,
        },
    ],
    valid: [
        {
            name: 'The self-restoring form.',
            code: `test('reads the token', () => {
                vi.stubEnv('API_TOKEN', 'secret');
                expect(read()).toBe('secret');
            });`,
            filename: TEST_FILE,
        },
        {
            name: 'Reading is not writing.',
            code: `test('reads the token', () => {
                expect(read()).toBe(process.env.API_TOKEN);
            });`,
            filename: TEST_FILE,
        },
        {
            name: 'Out of reach outside a test.',
            code: `process.env.API_TOKEN = 'secret';`,
            filename: '/repo/src/domain/order.ts',
        },
    ],
});

ruleTester().run('no-raw-env-write — the other two spellings', noRawEnvWrite, {
    invalid: [
        {
            name: 'Replacing the whole environment outlasts the test just the same.',
            code: `test('reads the token', () => {
                process.env = { ...process.env, API_TOKEN: 'secret' };
                expect(read()).toBe('secret');
            });`,
            errors: [{ column: 16, line: 2, messageId: 'rawAssignment' }],
            filename: TEST_FILE,
        },
        {
            name: 'And so does taking a variable away.',
            code: `test('reads no token', () => {
                delete process.env.API_TOKEN;
                expect(read()).toBe(undefined);
            });`,
            errors: [{ column: 16, line: 2, messageId: 'rawAssignment' }],
            filename: TEST_FILE,
        },
    ],
    valid: [
        {
            name: "Deleting something else is nobody's business here.",
            code: `test('drops the key', () => {
                delete config.token;
                expect(read()).toBe(undefined);
            });`,
            filename: TEST_FILE,
        },
    ],
});
