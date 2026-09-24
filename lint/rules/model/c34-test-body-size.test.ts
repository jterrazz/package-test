import { asOxlintRule, ruleTester } from '../../rule-tester.fixtures.js';
import { c34TestBodySize, MAX_TEST_LINES } from './c34-test-body-size.js';

const SPEC = '/repo/specs/api/events/list/pagination.spec.ts';

/** A test call whose body spans `lines` lines, its opening and closing lines included. */
function testOf(lines: number, opener = "test('a', () => {"): string {
    return [opener, ...Array.from({ length: lines - 2 }, () => '    // …'), '});'].join('\n');
}

ruleTester().run('c34-test-body-size', asOxlintRule(c34TestBodySize), {
    invalid: [
        {
            code: testOf(MAX_TEST_LINES + 1),
            errors: [{ message: /found: a test body of 61 lines, over 60/u }],
            filename: SPEC,
        },
        // Every form of the test call: `it`, a modifier, a table.
        { code: testOf(MAX_TEST_LINES + 1, "it('a', () => {"), errors: 1, filename: SPEC },
        {
            code: testOf(MAX_TEST_LINES + 1, "test.skip('a', async function () {"),
            errors: 1,
            filename: SPEC,
        },
        {
            code: testOf(MAX_TEST_LINES + 1, "test.each([1, 2])('a %s', (n) => {"),
            errors: 1,
            filename: SPEC,
        },
        // A module test and a component test are tests too.
        { code: testOf(MAX_TEST_LINES + 1), errors: 1, filename: '/repo/src/events/list.test.ts' },
        {
            code: testOf(MAX_TEST_LINES + 1),
            errors: 1,
            filename: '/repo/src/components/table.test.tsx',
        },
    ],
    valid: [
        { code: testOf(MAX_TEST_LINES), filename: SPEC },
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
