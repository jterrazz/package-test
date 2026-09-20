import { asOxlintRule, ruleTester } from '../../rule-tester.fixtures.js';
import { d18wExistenceOnlyOracle } from './d18w-existence-only-oracle.js';

const TEST_FILE = '/repo/src/domain/order.test.ts';

ruleTester().run('d18w-existence-only-oracle', asOxlintRule(d18wExistenceOnlyOracle), {
    invalid: [
        // The whole proof is that something came back.
        {
            code: `test('builds', () => {
                expect(build()).toBeDefined();
            });`,
            errors: [{ messageId: 'existenceOnly' }],
            filename: TEST_FILE,
        },
        // The negated form says no more.
        {
            code: `test('builds', () => {
                expect(build()).not.toBeNull();
            });`,
            errors: [{ messageId: 'existenceOnly' }],
            filename: TEST_FILE,
        },
        // A bare `toThrow` states only that something was raised.
        {
            code: `test('refuses', () => {
                expect(() => build(null)).toThrow();
            });`,
            errors: [{ messageId: 'existenceOnly' }],
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
        // A named refusal is an assertion about the message.
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
