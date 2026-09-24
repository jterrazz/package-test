import { asOxlintRule, ruleTester } from '../../rule-tester.fixtures.js';
import { c31DescribeNamesFile } from './c31-describe-names-file.js';

const SPEC = '/repo/specs/api/events/list/pagination.spec.ts';

ruleTester().run('c31-describe-names-file', asOxlintRule(c31DescribeNamesFile), {
    invalid: [
        // No describe: the tests are wrapped in one titled with the aspect.
        {
            code: "import { test } from 'vitest';\ntest('a', () => {});\ntest('b', () => {});",
            errors: [{ messageId: 'noDescribe' }],
            filename: SPEC,
            output: "import { describe, test } from 'vitest';\ndescribe('pagination', () => {\ntest('a', () => {});\ntest('b', () => {});\n});",
        },
        // A file with no vitest import gets one line of its own.
        {
            code: "test('a', () => {});",
            errors: [{ messageId: 'noDescribe' }],
            filename: SPEC,
            output: "import { describe } from 'vitest';\ndescribe('pagination', () => {\ntest('a', () => {});\n});",
        },
        // A title that is not the aspect is renamed.
        {
            code: "describe('events listing', () => {\n    test('a', () => {});\n});",
            errors: [{ messageId: 'wrongTitle' }],
            filename: SPEC,
            output: "describe('pagination', () => {\n    test('a', () => {});\n});",
        },
        // What stands between the tests stays at module scope, above the describe.
        {
            code: "import { test } from 'vitest';\ntest('a', () => {});\nconst page = 1;\ntest('b', () => { page; });",
            errors: [{ messageId: 'noDescribe' }],
            filename: SPEC,
            output: "import { describe, test } from 'vitest';\nconst page = 1;\ndescribe('pagination', () => {\ntest('a', () => {});\ntest('b', () => { page; });\n});",
        },
        // Two groups merge into one, one level deep: a group's tests carry its title.
        {
            code: "describe('pagination', () => {\n    test('a', () => {});\n});\nconst page = 1;\ndescribe('filters', () => {\n    test('by date', () => {});\n    test(`by place`, () => {});\n});",
            errors: [{ messageId: 'severalDescribes' }],
            filename: SPEC,
            output: "const page = 1;\ndescribe('pagination', () => {\ntest('a', () => {});\ntest('filters — by date', () => {});\n    test(`filters — by place`, () => {});\n});",
        },
        // A group title is escaped for the quotes of the test it prefixes.
        {
            code: "describe('pagination', () => {});\ndescribe(\"the user's page\", () => {\n    test('a', () => {});\n});",
            errors: [{ messageId: 'severalDescribes' }],
            filename: SPEC,
            output: "describe('pagination', () => {\ntest('the user\\'s page — a', () => {});\n});",
        },
        // A group with a hook, or run per row, is a scope: refused, left to the author.
        {
            code: "describe('pagination', () => {});\ndescribe('filters', () => {\n    beforeEach(reset);\n    test('a', () => {});\n});",
            errors: [{ messageId: 'severalDescribes' }],
            filename: SPEC,
            output: null,
        },
        {
            code: "describe('pagination', () => {});\ndescribe.each([1, 2])('page %s', () => {\n    test('a', () => {});\n});",
            errors: [{ messageId: 'severalDescribes' }],
            filename: SPEC,
            output: null,
        },
        // A test beside the describe goes into it.
        {
            code: "describe('pagination', () => {\n    test('a', () => {});\n});\ntest('stray', () => {});",
            errors: [{ messageId: 'testOutside' }],
            filename: SPEC,
            output: "describe('pagination', () => {\ntest('a', () => {});\ntest('stray', () => {});\n});",
        },
        // A table names its rows: the aspect is prefixed, the rest kept.
        {
            code: "describe.each([1, 2])('page %s', (n) => {\n    test('a', () => {});\n});",
            errors: [{ messageId: 'tableTitle' }],
            filename: SPEC,
            output: "describe.each([1, 2])('pagination — page %s', (n) => {\n    test('a', () => {});\n});",
        },
        {
            code: 'describe.each([1, 2])(TITLE, (n) => {});',
            errors: [{ messageId: 'tableTitle' }],
            filename: SPEC,
            output: null,
        },
    ],
    valid: [
        // One describe, titled with the aspect, holding every test.
        { code: "describe('pagination', () => {\n    test('a', () => {});\n});", filename: SPEC },
        // A table whose title starts with the aspect.
        {
            code: "describe.each([1, 2])('pagination — page %s', (n) => {\n    test('a', () => {});\n});",
            filename: SPEC,
        },
        // A module test is the unit's: out of reach.
        { code: "test('a', () => {});", filename: '/repo/src/events/list.test.ts' },
        // A specification file declares no test.
        {
            code: 'export const { api } = await specification.api({});',
            filename: '/repo/specs/api/api.specification.ts',
        },
    ],
});
