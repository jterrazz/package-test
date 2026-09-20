import { asOxlintRule, ruleTester } from '../rule-tester.fixtures.js';
import { b12MarkerBetweenStatements } from './b12-marker-between-statements.js';

const TEST_FILE = '/repo/src/domain/order.test.ts';

ruleTester().run('b12-marker-between-statements', asOxlintRule(b12MarkerBetweenStatements), {
    invalid: [
        // The narration swallowed by a declarator chain.
        {
            code: `test('ships', () => {
                // Given - a paid order
                const order = paid(),
                    // Then - it leaves the warehouse
                    shipped = ship(order);
                expect(shipped).toBe(true);
            });`,
            errors: [{ messageId: 'insideDeclaration' }],
            filename: TEST_FILE,
        },
    ],
    valid: [
        // Markers between statements, whatever the declarations look like.
        {
            code: `test('ships', () => {
                // Given - a paid order
                const order = paid(),
                    warehouse = open();
                // Then - it leaves
                expect(ship(order, warehouse)).toBe(true);
            });`,
            filename: TEST_FILE,
        },
        // A single declarator has no inside to hide a marker in.
        {
            code: `test('ships', () => {
                // Given - a paid order
                const order = paid();
                // Then - it leaves
                expect(ship(order)).toBe(true);
            });`,
            filename: TEST_FILE,
        },
    ],
});
