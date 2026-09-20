import { asOxlintRule, ruleTester } from '../rule-tester.fixtures.js';
import { b11MarkerOneLine } from './b11-marker-one-line.js';

const TEST_FILE = '/repo/src/domain/order.test.ts';

ruleTester().run('b11-marker-one-line', asOxlintRule(b11MarkerOneLine), {
    invalid: [
        // The sentence wrapped onto a second comment line.
        {
            code: `test('ships', () => {
    // Given - a paid order, placed by a customer whose address
    // the warehouse can reach in one day
    const order = paid();
    // Then - it leaves the warehouse
    expect(ship(order)).toBe(true);
});`,
            errors: [{ messageId: 'wrapped' }],
            filename: TEST_FILE,
        },
        // Both markers wrapped: one report each.
        {
            code: `test('ships', () => {
    // Given - a paid order
    // placed yesterday
    const order = paid();
    // Then - it leaves
    // through the loading dock
    expect(ship(order)).toBe(true);
});`,
            errors: [{ messageId: 'wrapped' }, { messageId: 'wrapped' }],
            filename: TEST_FILE,
        },
    ],
    valid: [
        // One line each.
        {
            code: `test('ships', () => {
    // Given - a paid order
    const order = paid();
    // Then - it leaves the warehouse
    expect(ship(order)).toBe(true);
});`,
            filename: TEST_FILE,
        },
        // A blank line makes the second comment a comment of its own.
        {
            code: `test('ships', () => {
    // Given - a paid order

    // the warehouse is open
    const order = paid();
    // Then - it leaves
    expect(ship(order)).toBe(true);
});`,
            filename: TEST_FILE,
        },
        // A deeper indentation belongs to the block below, not to the marker.
        {
            code: `test('ships', () => {
    // Given - a paid order
        // the nested note
    const order = paid();
    // Then - it leaves
    expect(ship(order)).toBe(true);
});`,
            filename: TEST_FILE,
        },
        // A suppression under a marker is an instruction to a tool, not a
        // Wrapped sentence: folding it into the marker would disable it.
        {
            code: `test('ships', () => {
    // Given - a paid order
    // oxlint-disable-next-line jterrazz/j2-no-sleep -- the clock primitive under test
    const order = paid();
    // Then - it leaves
    expect(order).toBe(true);
});`,
            filename: TEST_FILE,
        },
        // Two markers in a row are two sentences, not a wrap.
        {
            code: `test('ships', () => {
    // Given - a paid order
    // When - the warehouse picks it up
    const order = ship(paid());
    // Then - it leaves
    expect(order).toBe(true);
});`,
            filename: TEST_FILE,
        },
    ],
});
