import { asOxlintRule, ruleTester } from '../../../engine/testing/rule-tester.fixtures.js';
import { noExpectInALoop } from './no-expect-in-a-loop.js';

const TEST_FILE = '/repo/src/domain/order.test.ts';

ruleTester().run('no-expect-in-a-loop', asOxlintRule(noExpectInALoop), {
    invalid: [
        {
            code: `test('totals', () => {
    for (const order of orders()) {
        expect(order.total).toBeGreaterThan(0);
    }
});`,
            errors: [{ line: 3, messageId: 'expectInALoop' }],
            filename: TEST_FILE,
        },
        {
            code: `test('totals', () => {
    let index = 0;
    while (index < 3) {
        expect.soft(total(index)).toBe(index);
        index += 1;
    }
});`,
            errors: [{ line: 4, messageId: 'expectInALoop' }],
            filename: TEST_FILE,
        },
        {
            code: `test('totals', () => {
    orders().forEach((order) => {
        expect(order.total).toBeGreaterThan(0);
    });
});`,
            errors: [{ line: 3, messageId: 'expectInALoop' }],
            filename: TEST_FILE,
        },
        {
            code: `test('ids', () => {
    rows.map((row) => expect(row.id).toBeTypeOf('string'));
    rows.flatMap((row) => [expect(row.tags).toHaveLength(1)]);
    rows.every((row) => {
        expect(row.id).toBeDefined();
        return true;
    });
    rows.some((row) => expect(row.id).toBe('a'));
});`,
            errors: [
                { line: 2, messageId: 'expectInALoop' },
                { line: 3, messageId: 'expectInALoop' },
                { line: 5, messageId: 'expectInALoop' },
                { line: 8, messageId: 'expectInALoop' },
            ],
            filename: TEST_FILE,
        },
    ],
    valid: [
        {
            code: `test('totals', () => {
    expect(orders().map((order) => order.total)).toStrictEqual([12, 30]);
});`,
            filename: TEST_FILE,
        },
        {
            code: `test('totals', () => {
    for (const order of orders()) {
        order.close();
    }
    expect(orders().map((order) => order.closed)).toStrictEqual([true, true]);
});`,
            filename: TEST_FILE,
        },
        {
            code: `test('totals', () => {
    const check = (value) => expect(value).toBe(1);
    for (const value of [1]) {
        record(value);
    }
    check(1);
});`,
            filename: TEST_FILE,
        },
        {
            code: `test('ids', () => {
    expect(rows.map((row) => row.id)).toStrictEqual(['a', 'b']);
    expect(rows.every((row) => row.id !== '')).toBe(true);
});`,
            filename: TEST_FILE,
        },
        {
            code: `for (const order of orders()) {
    expect(order.total).toBeGreaterThan(0);
}`,
            filename: '/repo/src/domain/order.ts',
        },
    ],
});
