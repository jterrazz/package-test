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
        // Two groups are two questions: refused, left to the author.
        {
            code: "describe('pagination', () => {});\ndescribe('filters', () => {});",
            errors: [{ messageId: 'severalDescribes' }],
            filename: SPEC,
        },
        // A test beside the describe is refused where it stands.
        {
            code: "describe('pagination', () => {});\ntest('stray', () => {});",
            errors: [{ messageId: 'testOutside' }],
            filename: SPEC,
        },
    ],
    valid: [
        // One describe, titled with the aspect, holding every test.
        { code: "describe('pagination', () => {\n    test('a', () => {});\n});", filename: SPEC },
        // A module test is the unit's: out of reach.
        { code: "test('a', () => {});", filename: '/repo/src/events/list.test.ts' },
        // A specification file declares no test.
        {
            code: 'export const { api } = await specification.api({});',
            filename: '/repo/specs/api/api.specification.ts',
        },
    ],
});
