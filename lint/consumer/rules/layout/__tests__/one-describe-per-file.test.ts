import { ruleTester } from '@jterrazz/test';
import { join } from 'node:path';

import { packageWith } from '../../../../kit/testing/package-tree.fixtures.js';
import { oneDescribePerFile } from '../one-describe-per-file.js';

const SPEC = '/repo/specs/api/events/list/pagination.spec.ts';

// invariant: a module and a component, each beside the test that names it.
const ROOT = packageWith({
    'src/locale-note.tsx': 'export const LABELS = {};\nexport function LocaleNote() {}\n',
    'src/route-judge.ts': 'export type Ledger = {};\nexport function judgeLedgers() {}\n',
});
const MODULE_TEST = join(ROOT, 'src/route-judge.test.ts');
const COMPONENT_TEST = join(ROOT, 'src/locale-note.test.tsx');

ruleTester().run('one-describe-per-file', oneDescribePerFile, {
    invalid: [
        {
            name: 'A table titled in a template is prefixed the same.',
            code: 'describe.each([1, 2])(`page %s`, (n) => {});',
            errors: [{ column: 22, line: 1, messageId: 'tableTitle' }],
            filename: SPEC,
            output: 'describe.each([1, 2])(`pagination — page %s`, (n) => {});',
        },
        {
            name: 'No describe: the tests are wrapped in one titled with the aspect.',
            code: "import { test } from 'vitest';\ntest('a', () => {});\ntest('b', () => {});",
            errors: [{ column: 0, line: 2, messageId: 'noDescribe' }],
            filename: SPEC,
            output: "import { describe, test } from 'vitest';\ndescribe('pagination', () => {\ntest('a', () => {});\ntest('b', () => {});\n});",
        },
        {
            name: 'A file with no vitest import gets one line of its own.',
            code: "test('a', () => {});",
            errors: [{ column: 0, line: 1, messageId: 'noDescribe' }],
            filename: SPEC,
            output: "import { describe } from 'vitest';\ndescribe('pagination', () => {\ntest('a', () => {});\n});",
        },
        {
            name: 'A title that is not the aspect is renamed.',
            code: "describe('events listing', () => {\n    test('a', () => {});\n});",
            errors: [{ column: 9, line: 1, messageId: 'wrongTitle' }],
            filename: SPEC,
            output: "describe('pagination', () => {\n    test('events listing — a', () => {});\n});",
        },
        {
            name: "A group with a hook is not renamed: its tests could not carry its title, which stays the author's to place.",
            code: "describe('events listing', () => {\n    beforeAll(seed);\n    test('a', () => {});\n});",
            errors: [{ column: 9, line: 1, messageId: 'wrongTitle' }],
            filename: SPEC,
            output: null,
        },
        {
            name: 'A group with a hook titled with the subject in another spelling is renamed: no title is lost.',
            code: "describe('<LocaleNote />', () => {\n    beforeAll(seed);\n    test('a', () => {});\n});",
            errors: [{ column: 9, line: 1, messageId: 'wrongTitle' }],
            filename: COMPONENT_TEST,
            output: "describe('LocaleNote', () => {\n    beforeAll(seed);\n    test('a', () => {});\n});",
        },
        {
            name: 'A test already carrying the group title, in any spelling, is not prefixed twice.',
            code: "describe('createArticle', () => {\n    test('createArticle — capitalizes', () => {});\n    test(`create article — trims`, () => {});\n    test('lowers', () => {});\n});",
            errors: [{ column: 9, line: 1, messageId: 'wrongTitle' }],
            filename: SPEC,
            output: "describe('pagination', () => {\n    test('createArticle — capitalizes', () => {});\n    test(`create article — trims`, () => {});\n    test('createArticle — lowers', () => {});\n});",
        },
        {
            name: 'A test titled with the group alone, or opening on another title, still carries the group.',
            code: "describe('createArticle', () => {\n    test('create article', () => {});\n    test('trims — the body', () => {});\n});",
            errors: [{ column: 9, line: 1, messageId: 'wrongTitle' }],
            filename: SPEC,
            output: "describe('pagination', () => {\n    test('createArticle — create article', () => {});\n    test('createArticle — trims — the body', () => {});\n});",
        },
        {
            name: 'A title opening on a capital — a constant, a type, a route — is not prefixed: the lowercase-title fix would rewrite it to a name nobody wrote.',
            code: "describe('pagination', () => {\n    test('a', () => {});\n});\ndescribe('ARTICLES_42_RELATED_INDICES', () => {\n    test('holds', () => {});\n});",
            errors: [{ column: 0, line: 4, messageId: 'severalDescribes' }],
            filename: SPEC,
            output: null,
        },
        {
            name: 'A group titled by a name is not renamed: the title it computes would be lost.',
            code: "describe(TITLE, () => {\n    test('a', () => {});\n});",
            errors: [{ column: 9, line: 1, messageId: 'wrongTitle' }],
            filename: SPEC,
            output: null,
        },
        {
            code: "describe('Article', () => {\n    test('a', () => {});\n});",
            errors: [{ column: 9, line: 1, messageId: 'wrongTitle' }],
            filename: SPEC,
            output: null,
        },
        {
            name: 'A table test in a merged group carries the group title like any other.',
            code: "describe('pagination', () => {});\ndescribe('filters', () => {\n    test.each([1, 2])('by %s', (n) => {});\n});",
            errors: [{ column: 0, line: 2, messageId: 'severalDescribes' }],
            filename: SPEC,
            output: "describe('pagination', () => {\ntest.each([1, 2])('filters — by %s', (n) => {});\n});",
        },
        {
            name: 'What stands between the tests stays at module scope, a blank line above the describe.',
            code: "import { test } from 'vitest';\ntest('a', () => {});\nconst page = 1;\ntest('b', () => { page; });",
            errors: [{ column: 0, line: 2, messageId: 'noDescribe' }],
            filename: SPEC,
            output: "import { describe, test } from 'vitest';\nconst page = 1;\n\ndescribe('pagination', () => {\ntest('a', () => {});\ntest('b', () => { page; });\n});",
        },
        {
            name: "Two groups merge into one, one level deep: a group's tests carry its title.",
            code: "describe('pagination', () => {\n    test('a', () => {});\n});\nconst page = 1;\ndescribe('filters', () => {\n    test('by date', () => {});\n    test(`by place`, () => {});\n});",
            errors: [{ column: 0, line: 5, messageId: 'severalDescribes' }],
            filename: SPEC,
            output: "const page = 1;\n\ndescribe('pagination', () => {\ntest('a', () => {});\ntest('filters — by date', () => {});\n    test(`filters — by place`, () => {});\n});",
        },
        {
            name: 'A group title is escaped for the quotes of the test it prefixes.',
            code: "describe('pagination', () => {});\ndescribe(\"the user's page\", () => {\n    test('a', () => {});\n});",
            errors: [{ column: 0, line: 2, messageId: 'severalDescribes' }],
            filename: SPEC,
            output: "describe('pagination', () => {\ntest('the user\\'s page — a', () => {});\n});",
        },
        {
            name: 'A group with a hook, or run per row, is a scope: refused, left to the author.',
            code: "describe('pagination', () => {});\ndescribe('filters', () => {\n    beforeEach(reset);\n    test('a', () => {});\n});",
            errors: [{ column: 0, line: 2, messageId: 'severalDescribes' }],
            filename: SPEC,
            output: null,
        },
        {
            code: "describe('pagination', () => {});\ndescribe.each([1, 2])('page %s', () => {\n    test('a', () => {});\n});",
            errors: [{ column: 0, line: 2, messageId: 'severalDescribes' }],
            filename: SPEC,
            output: null,
        },
        {
            name: 'A test beside the describe goes into it.',
            code: "describe('pagination', () => {\n    test('a', () => {});\n});\ntest('stray', () => {});",
            errors: [{ column: 0, line: 4, messageId: 'testOutside' }],
            filename: SPEC,
            output: "describe('pagination', () => {\ntest('a', () => {});\ntest('stray', () => {});\n});",
        },
        {
            name: 'A table names its rows: the aspect is prefixed, the rest kept.',
            code: "describe.each([1, 2])('page %s', (n) => {\n    test('a', () => {});\n});",
            errors: [{ column: 22, line: 1, messageId: 'tableTitle' }],
            filename: SPEC,
            output: "describe.each([1, 2])('pagination — page %s', (n) => {\n    test('a', () => {});\n});",
        },
        {
            code: 'describe.each([1, 2])(TITLE, (n) => {});',
            errors: [
                {
                    column: 22,
                    line: 1,
                    message: /^found: the file’s `describe\.each` is titled "a computed title" · /u,
                },
            ],
            filename: SPEC,
            output: null,
        },
        {
            name: 'A module test is titled with its subject: the one function its module exports.',
            code: "import { test } from 'vitest';\ntest('a', () => {});",
            errors: [{ column: 0, line: 2, messageId: 'noDescribe' }],
            filename: MODULE_TEST,
            output: "import { describe, test } from 'vitest';\ndescribe('judgeLedgers', () => {\ntest('a', () => {});\n});",
        },
        {
            code: "describe('route judge', () => {\n    test('a', () => {});\n});",
            errors: [{ column: 9, line: 1, messageId: 'wrongTitle' }],
            filename: MODULE_TEST,
            output: "describe('judgeLedgers', () => {\n    test('a', () => {});\n});",
        },
        {
            name: 'A group titled with the subject its module exports, in another spelling, hands its tests no prefix.',
            code: "describe('judge ledgers', () => {\n    test('a', () => {});\n});",
            errors: [{ column: 9, line: 1, messageId: 'wrongTitle' }],
            filename: MODULE_TEST,
            output: "describe('judgeLedgers', () => {\n    test('a', () => {});\n});",
        },
        {
            name: 'A group titled with its subject in another spelling hands its tests no prefix.',
            code: "describe('<LocaleNote />', () => {\n    test('a', () => {});\n});",
            errors: [{ column: 9, line: 1, messageId: 'wrongTitle' }],
            filename: COMPONENT_TEST,
            output: "describe('LocaleNote', () => {\n    test('a', () => {});\n});",
        },
        {
            name: 'A merged group titled with the subject in another spelling hands its tests no prefix either.',
            code: "describe('LocaleNote', () => {\n    test('a', () => {});\n});\ndescribe('locale note', () => {\n    test('b', () => {});\n});",
            errors: [{ column: 0, line: 4, messageId: 'severalDescribes' }],
            filename: COMPONENT_TEST,
            output: "describe('LocaleNote', () => {\ntest('a', () => {});\ntest('b', () => {});\n});",
        },
        {
            name: "A component test's subject is the export spelling its base name.",
            code: "describe('LocaleNote', () => {\n    test('a', () => {});\n});\ndescribe('labels', () => {\n    test('b', () => {});\n});",
            errors: [{ column: 0, line: 4, messageId: 'severalDescribes' }],
            filename: COMPONENT_TEST,
            output: "describe('LocaleNote', () => {\ntest('a', () => {});\ntest('labels — b', () => {});\n});",
        },
        {
            name: 'A group titled by a name, or holding a test titled by one or by nothing, cannot flatten.',
            code: "describe('pagination', () => {});\ndescribe(name, () => {\n    test('a', () => {});\n});",
            errors: [{ column: 0, line: 2, messageId: 'severalDescribes' }],
            filename: SPEC,
            output: null,
        },
        {
            code: "describe('pagination', () => {});\ndescribe('filters', () => {\n    test(title, () => {});\n});",
            errors: [{ column: 0, line: 2, messageId: 'severalDescribes' }],
            filename: SPEC,
            output: null,
        },
        {
            code: "describe('pagination', () => {});\ndescribe('filters', () => {\n    log('a');\n    test('b', () => {});\n});",
            errors: [{ column: 0, line: 2, messageId: 'severalDescribes' }],
            filename: SPEC,
            output: null,
        },
        {
            code: "describe('pagination', () => {});\ndescribe('filters', () => {\n    test();\n});",
            errors: [{ column: 0, line: 2, messageId: 'severalDescribes' }],
            filename: SPEC,
            output: null,
        },
        {
            name: 'What follows the last group stays after the merged one, and a note above a hoisted statement goes with it.',
            code: "describe('pagination', () => {\n    test('a', () => {});\n});\n// the page read\nconst page = 1;\ndescribe('filters', () => {\n    test('b', () => {});\n});\nconst after = 2;",
            errors: [{ column: 0, line: 6, messageId: 'severalDescribes' }],
            filename: SPEC,
            output: "// the page read\nconst page = 1;\n\ndescribe('pagination', () => {\ntest('a', () => {});\ntest('filters — b', () => {});\n});\nconst after = 2;",
        },
        {
            name: 'describe joins the vitest import, not another one, and is not added twice.',
            code: "import { expect } from 'other';\nimport { test } from 'vitest';\ntest('a', () => {});",
            errors: [{ column: 0, line: 3, messageId: 'noDescribe' }],
            filename: SPEC,
            output: "import { expect } from 'other';\nimport { describe, test } from 'vitest';\ndescribe('pagination', () => {\ntest('a', () => {});\n});",
        },
        {
            code: "import { describe, test } from 'vitest';\ntest('a', () => {});",
            errors: [{ column: 0, line: 2, messageId: 'noDescribe' }],
            filename: SPEC,
            output: "import { describe, test } from 'vitest';\ndescribe('pagination', () => {\ntest('a', () => {});\n});",
        },
        {
            name: 'A namespace import of vitest gets a named import of its own.',
            code: "import * as vitest from 'vitest';\ntest('a', () => {});",
            errors: [{ column: 0, line: 2, messageId: 'noDescribe' }],
            filename: SPEC,
            output: "import { describe } from 'vitest';\nimport * as vitest from 'vitest';\ndescribe('pagination', () => {\ntest('a', () => {});\n});",
        },
    ],
    valid: [
        {
            name: 'A group with no title names nothing to judge.',
            code: 'describe();',
            filename: SPEC,
        },
        {
            name: 'One describe, titled with the aspect, holding every test.',
            code: "describe('pagination', () => {\n    test('a', () => {});\n});",
            filename: SPEC,
        },
        {
            name: 'A table whose title starts with the aspect.',
            code: "describe.each([1, 2])('pagination — page %s', (n) => {\n    test('a', () => {});\n});",
            filename: SPEC,
        },
        {
            name: 'A colocated test titled with its subject.',
            code: "describe('judgeLedgers', () => {\n    test('a', () => {});\n});",
            filename: MODULE_TEST,
        },
        {
            name: "A file declaring no test of its own (a rule tester's cases) is out of reach.",
            code: "ruleTester().run('r', rule, { invalid: [], valid: [] });",
            filename: MODULE_TEST,
        },
        {
            name: 'A type test runs no describe: out of reach.',
            code: "test('a', () => {});",
            filename: '/repo/src/chain.test-d.ts',
        },
        {
            name: 'A specification file declares no test.',
            code: 'export const { api } = await specification.api({});',
            filename: '/repo/specs/api/api.specification.ts',
        },
    ],
});
