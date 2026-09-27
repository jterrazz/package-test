import { ruleTester } from '../../../engine/testing/rule-tester.js';
import { MAX_TEST_LINES, testBodyWithinLineLimit } from './test-body-within-line-limit.js';

const SPEC = '/repo/specs/api/events/list/pagination.spec.ts';

function testOf(lines: number, opener = "test('a', () => {"): string {
    return [opener, ...Array.from({ length: lines - 2 }, () => '    // …'), '});'].join('\n');
}

function claimedTestOf(gestures: number, claim: number): string {
    const value = ['`', ...Array.from({ length: claim - 2 }, () => '        line'), '    `'];
    return [
        "test('a', () => {",
        ...Array.from({ length: gestures - 3 }, () => '    // …'),
        `    expect(result).toMatch(${value.join('\n')});`,
        '});',
    ].join('\n');
}

ruleTester().run('test-body-within-line-limit', testBodyWithinLineLimit, {
    invalid: [
        {
            code: testOf(MAX_TEST_LINES + 1),
            errors: [
                {
                    column: 10,
                    line: 1,
                    message: /found: a test body of 61 lines of gestures, over 60/u,
                },
            ],
            filename: SPEC,
        },
        // A `toMatch` value spares its own lines, never the gestures around it.
        {
            code: claimedTestOf(MAX_TEST_LINES + 1, 5),
            errors: [
                {
                    column: 10,
                    line: 1,
                    message: /found: a test body of 61 lines of gestures, over 60/u,
                },
            ],
            filename: SPEC,
        },
        // Every form of the test call: `it`, a modifier, a table.
        {
            code: testOf(MAX_TEST_LINES + 1, "it('a', () => {"),
            errors: [{ column: 8, line: 1, messageId: 'tooLong' }],
            filename: SPEC,
        },
        {
            code: testOf(MAX_TEST_LINES + 1, "test.skip('a', async function () {"),
            errors: [{ column: 15, line: 1, messageId: 'tooLong' }],
            filename: SPEC,
        },
        {
            code: testOf(MAX_TEST_LINES + 1, "test.each([1, 2])('a %s', (n) => {"),
            errors: [{ column: 26, line: 1, messageId: 'tooLong' }],
            filename: SPEC,
        },
        // A module test and a component test are tests too.
        {
            code: testOf(MAX_TEST_LINES + 1),
            errors: [{ column: 10, line: 1, messageId: 'tooLong' }],
            filename: '/repo/src/events/list.test.ts',
        },
        {
            code: testOf(MAX_TEST_LINES + 1),
            errors: [{ column: 10, line: 1, messageId: 'tooLong' }],
            filename: '/repo/src/components/table.test.tsx',
        },
    ],
    valid: [
        { code: testOf(MAX_TEST_LINES), filename: SPEC },
        // The claim is not counted: twenty lines of gestures and a ninety-line inline expectation.
        { code: claimedTestOf(20, 90), filename: SPEC },
        { code: claimedTestOf(MAX_TEST_LINES, 90), filename: SPEC },
        // The file's describe is as long as the file: only the test is capped.
        {
            code: `describe('pagination', () => {\n${testOf(MAX_TEST_LINES)}\n${testOf(MAX_TEST_LINES)}\n});`,
            filename: SPEC,
        },
        // A test handed a named function is judged where that function is.
        { code: "test('a', run);", filename: SPEC },
        // A specification file declares no test.
        { code: testOf(MAX_TEST_LINES + 1), filename: '/repo/specs/api/api.specification.ts' },
    ],
});
