import { join } from 'node:path';

import { packageWith } from '../../../engine/testing/package-tree.fixtures.js';
import { asOxlintRule, ruleTester } from '../../../engine/testing/rule-tester.fixtures.js';
import { oneDescribePerFile } from './one-describe-per-file.js';

const SPEC = '/repo/specs/api/events/list/pagination.spec.ts';

// A module and a component, each beside the test that names it.
const ROOT = packageWith({
    'src/locale-note.tsx': 'export const LABELS = {};\nexport function LocaleNote() {}\n',
    'src/route-judge.ts': 'export type Ledger = {};\nexport function judgeLedgers() {}\n',
});
const MODULE_TEST = join(ROOT, 'src/route-judge.test.ts');
const COMPONENT_TEST = join(ROOT, 'src/locale-note.test.tsx');

ruleTester().run('one-describe-per-file', asOxlintRule(oneDescribePerFile), {
    invalid: [
        // No describe: the tests are wrapped in one titled with the aspect.
        {
            code: "import { test } from 'vitest';\ntest('a', () => {});\ntest('b', () => {});",
            errors: [{ column: 0, line: 2, messageId: 'noDescribe' }],
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
            errors: [{ column: 9, line: 1, messageId: 'wrongTitle' }],
            filename: SPEC,
            output: "describe('pagination', () => {\n    test('events listing — a', () => {});\n});",
        },
        // A group with a hook is only renamed: its title stays the author's to place.
        {
            code: "describe('events listing', () => {\n    beforeAll(seed);\n    test('a', () => {});\n});",
            errors: [{ column: 9, line: 1, messageId: 'wrongTitle' }],
            filename: SPEC,
            output: "describe('pagination', () => {\n    beforeAll(seed);\n    test('a', () => {});\n});",
        },
        // What stands between the tests stays at module scope, a blank line above the describe.
        {
            code: "import { test } from 'vitest';\ntest('a', () => {});\nconst page = 1;\ntest('b', () => { page; });",
            errors: [{ messageId: 'noDescribe' }],
            filename: SPEC,
            output: "import { describe, test } from 'vitest';\nconst page = 1;\n\ndescribe('pagination', () => {\ntest('a', () => {});\ntest('b', () => { page; });\n});",
        },
        // Two groups merge into one, one level deep: a group's tests carry its title.
        {
            code: "describe('pagination', () => {\n    test('a', () => {});\n});\nconst page = 1;\ndescribe('filters', () => {\n    test('by date', () => {});\n    test(`by place`, () => {});\n});",
            errors: [{ messageId: 'severalDescribes' }],
            filename: SPEC,
            output: "const page = 1;\n\ndescribe('pagination', () => {\ntest('a', () => {});\ntest('filters — by date', () => {});\n    test(`filters — by place`, () => {});\n});",
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
            errors: [{ column: 0, line: 4, messageId: 'testOutside' }],
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
        // A module test is titled with its subject: the one function its module exports.
        {
            code: "import { test } from 'vitest';\ntest('a', () => {});",
            errors: [{ column: 0, line: 2, messageId: 'noDescribe' }],
            filename: MODULE_TEST,
            output: "import { describe, test } from 'vitest';\ndescribe('judgeLedgers', () => {\ntest('a', () => {});\n});",
        },
        {
            code: "describe('route judge', () => {\n    test('a', () => {});\n});",
            errors: [{ column: 9, line: 1, messageId: 'wrongTitle' }],
            filename: MODULE_TEST,
            output: "describe('judgeLedgers', () => {\n    test('route judge — a', () => {});\n});",
        },
        // A component test's subject is the export spelling its base name.
        {
            code: "describe('LocaleNote', () => {\n    test('a', () => {});\n});\ndescribe('labels', () => {\n    test('b', () => {});\n});",
            errors: [{ column: 0, line: 4, messageId: 'severalDescribes' }],
            filename: COMPONENT_TEST,
            output: "describe('LocaleNote', () => {\ntest('a', () => {});\ntest('labels — b', () => {});\n});",
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
        // A colocated test titled with its subject.
        {
            code: "describe('judgeLedgers', () => {\n    test('a', () => {});\n});",
            filename: MODULE_TEST,
        },
        // A file declaring no test of its own (a rule tester's cases) is out of reach.
        { code: "ruleTester().run('r', rule, { invalid: [], valid: [] });", filename: MODULE_TEST },
        // A type test runs no describe: out of reach.
        { code: "test('a', () => {});", filename: '/repo/src/chain.test-d.ts' },
        // A specification file declares no test.
        {
            code: 'export const { api } = await specification.api({});',
            filename: '/repo/specs/api/api.specification.ts',
        },
    ],
});
