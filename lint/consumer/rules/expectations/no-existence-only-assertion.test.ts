import { ruleTester } from '@jterrazz/test';

import { noExistenceOnlyAssertion } from './no-existence-only-assertion.js';

const TEST_FILE = '/repo/src/domain/order.test.ts';

ruleTester().run('no-existence-only-assertion', noExistenceOnlyAssertion, {
    invalid: [
        // The whole proof is that something came back.
        {
            code: `test('builds', () => {
                expect(build()).toBeDefined();
            });`,
            errors: [{ column: 0, line: 1, messageId: 'existenceOnly' }],
            filename: TEST_FILE,
        },
        // The negated form says no more.
        {
            code: `test('builds', () => {
                expect(build()).not.toBeNull();
            });`,
            errors: [{ column: 0, line: 1, messageId: 'existenceOnly' }],
            filename: TEST_FILE,
        },
        {
            code: `test('notifies', () => {
                notify({ onSent });
                expect(onSent).toHaveBeenCalled();
            });`,
            errors: [{ column: 0, line: 1, messageId: 'existenceOnly' }],
            filename: TEST_FILE,
        },
    ],
    valid: [
        // A precondition beside the real oracle.
        {
            code: `test('builds', () => {
                const result = build();
                expect(result).toBeDefined();
                expect(result.name).toBe('widget');
            });`,
            filename: TEST_FILE,
        },
        {
            code: `test('builds', () => {
                expect(build()).toBeTruthy();
            });`,
            filename: TEST_FILE,
        },
        {
            code: `test('refuses', () => {
                expect(() => build(null)).toThrow();
            });`,
            filename: TEST_FILE,
        },
        {
            code: `test('refuses', () => {
                expect(() => build(null)).toThrow('name is required');
            });`,
            filename: TEST_FILE,
        },
        // A real oracle.
        {
            code: `test('builds', () => {
                expect(build().name).toBe('widget');
            });`,
            filename: TEST_FILE,
        },
        // A precise negative: nothing happened, which nothing else states.
        {
            code: `test('stays open', () => {
                open({ onClose });
                expect(onClose).not.toHaveBeenCalled();
            });`,
            filename: TEST_FILE,
        },
        // A soft assertion is an assertion — two oracles, not one.
        {
            code: `test('builds', () => {
                const result = build();
                expect.soft(result.name).toBe('widget');
                expect(result).toBeDefined();
            });`,
            filename: TEST_FILE,
        },
    ],
});
