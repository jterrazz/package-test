import { ruleTester } from '../../../engine/testing/rule-tester.js';
import { whenBetweenGivenAndThen } from './when-between-given-and-then.js';

const TEST_FILE = '/repo/src/domain/order.test.ts';

ruleTester().run('when-between-given-and-then', whenBetweenGivenAndThen, {
    invalid: [
        // The action narrated before the setup it acts on.
        {
            code: `test('ships', () => {
                // When - the order is shipped
                // Given - a paid order
                const order = paid();
                // Then - it leaves the warehouse
                expect(ship(order)).toBe(true);
            });`,
            errors: [{ column: 0, line: 1, messageId: 'beforeGiven' }],
            filename: TEST_FILE,
        },
        // The action narrated after the outcome.
        {
            code: `test('ships', () => {
                // Given - a paid order
                const order = paid();
                // Then - it leaves the warehouse
                expect(ship(order)).toBe(true);
                // When - the order is shipped
            });`,
            errors: [{ column: 0, line: 1, messageId: 'afterThen' }],
            filename: TEST_FILE,
        },
    ],
    valid: [
        // The optional marker in its place.
        {
            code: `test('ships', () => {
                // Given - a paid order
                const order = paid();
                // When - the warehouse picks it up
                const result = ship(order);
                // Then - it leaves
                expect(result).toBe(true);
            });`,
            filename: TEST_FILE,
        },
        // No `When` at all: the chain is the action (the majority shape).
        {
            code: `test('ships', () => {
                // Given - a paid order
                const order = paid();
                // Then - it leaves the warehouse
                expect(ship(order)).toBe(true);
            });`,
            filename: TEST_FILE,
        },
        // Outside a test role the rule is inert.
        {
            code: `// When - production code narrates nothing
            test('x', () => { /* Then - */ });`,
            filename: '/repo/src/domain/order.ts',
        },
    ],
});
