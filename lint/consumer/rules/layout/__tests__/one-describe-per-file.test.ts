import { ruleTester } from '@jterrazz/test';
import { join } from 'node:path';

import { packageWith } from '../../../../__tests__/package-tree.fixtures.js';
import { oneDescribePerFile } from '../one-describe-per-file.js';

const SPEC = '/repo/specs/api/events/list/pagination.spec.ts';

// invariant: a module and a component, each beside the test that names it.
const ROOT = packageWith({
    'src/locale-note.tsx': 'export const LABELS = {};\nexport function LocaleNote() {}\n',
    'src/route-judge.ts': 'export type Ledger = {};\nexport function judgeLedgers() {}\n',
});
const MODULE_TEST = join(ROOT, 'src/route-judge.test.ts');
const COMPONENT_TEST = join(ROOT, 'src/locale-note.test.tsx');

const PAGE_SPEC = '/repo/specs/website/articles/[id]/reading.spec.ts';
const PAGE_CHAIN = "import { website } from '../../website.specification.js';\n";

ruleTester().run('one-describe-per-file', oneDescribePerFile, {
    invalid: [
        {
            name: 'A page the spec does not visit is no title for it.',
            code: `${PAGE_CHAIN}describe('/articles/:slug', () => {\n    test('a', async () => {\n        await website.visit('/articles/42', async () => {});\n    });\n});`,
            errors: [{ column: 9, line: 2, messageId: 'wrongTitle' }],
            filename: PAGE_SPEC,
        },
        {
            name: 'A table titled in a template is reported, its title left to its author.',
            code: 'describe.each([1, 2])(`page %s`, (n) => {});',
            errors: [{ column: 22, line: 1, messageId: 'tableTitle' }],
            filename: SPEC,
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
            name: 'A title that is not the aspect is reported, never renamed: no title of an author is rewritten.',
            code: "describe('events listing', () => {\n    test('a', () => {});\n});",
            errors: [{ column: 9, line: 1, messageId: 'wrongTitle' }],
            filename: SPEC,
        },
        {
            name: 'A group with a hook is reported the same.',
            code: "describe('events listing', () => {\n    beforeAll(seed);\n    test('a', () => {});\n});",
            errors: [{ column: 9, line: 1, messageId: 'wrongTitle' }],
            filename: SPEC,
        },
        {
            name: 'Two groups merge, each test keeping its own title, whatever a title opens on.',
            code: "describe('pagination', () => {\n    test('a', () => {});\n});\ndescribe('ARTICLES_42_RELATED_INDICES', () => {\n    test('holds', () => {});\n});",
            errors: [{ column: 0, line: 4, messageId: 'severalDescribes' }],
            filename: SPEC,
            output: "describe('pagination', () => {\ntest('a', () => {});\ntest('holds', () => {});\n});",
        },
        {
            name: 'Two groups holding a test of one title are not merged: the failure would lose its name.',
            code: "describe('pagination', () => {\n    test('holds', () => {});\n});\ndescribe('filters', () => {\n    test('holds', () => {});\n});",
            errors: [{ column: 0, line: 4, messageId: 'severalDescribes' }],
            filename: SPEC,
            output: null,
        },
        {
            name: 'A top-level test colliding with a test of the group is not wrapped into it.',
            code: "describe('pagination', () => {\n    test('holds', () => {});\n});\ntest('holds', () => {});",
            errors: [{ column: 0, line: 4, messageId: 'testOutside' }],
            filename: SPEC,
            output: null,
        },
        {
            name: 'A group titled by a name is reported.',
            code: "describe(TITLE, () => {\n    test('a', () => {});\n});",
            errors: [{ column: 9, line: 1, messageId: 'wrongTitle' }],
            filename: SPEC,
        },
        {
            code: "describe('Article', () => {\n    test('a', () => {});\n});",
            errors: [{ column: 9, line: 1, messageId: 'wrongTitle' }],
            filename: SPEC,
        },
        {
            name: 'A table test in a merged group is moved as written.',
            code: "describe('pagination', () => {});\ndescribe('filters', () => {\n    test.each([1, 2])('by %s', (n) => {});\n});",
            errors: [{ column: 0, line: 2, messageId: 'severalDescribes' }],
            filename: SPEC,
            output: "describe('pagination', () => {\ntest.each([1, 2])('by %s', (n) => {});\n});",
        },
        {
            name: 'What stands between the tests stays at module scope, a blank line above the describe.',
            code: "import { test } from 'vitest';\ntest('a', () => {});\nconst page = 1;\ntest('b', () => { page; });",
            errors: [{ column: 0, line: 2, messageId: 'noDescribe' }],
            filename: SPEC,
            output: "import { describe, test } from 'vitest';\nconst page = 1;\n\ndescribe('pagination', () => {\ntest('a', () => {});\ntest('b', () => { page; });\n});",
        },
        {
            name: "Two groups merge into one, one level deep: their tests keep their titles and the second group's own leaves with it.",
            code: "describe('pagination', () => {\n    test('a', () => {});\n});\nconst page = 1;\ndescribe('filters', () => {\n    test('by date', () => {});\n    test(`by place`, () => {});\n});",
            errors: [{ column: 0, line: 5, messageId: 'severalDescribes' }],
            filename: SPEC,
            output: "const page = 1;\n\ndescribe('pagination', () => {\ntest('a', () => {});\ntest('by date', () => {});\n    test(`by place`, () => {});\n});",
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
            name: 'A table names its rows: its title must start with the aspect, and is reported when it does not.',
            code: "describe.each([1, 2])('page %s', (n) => {\n    test('a', () => {});\n});",
            errors: [{ column: 22, line: 1, messageId: 'tableTitle' }],
            filename: SPEC,
        },
        {
            code: 'describe.each([1, 2])(TITLE, (n) => {});',
            errors: [
                {
                    column: 22,
                    line: 1,
                    message: /^found: the file's `describe\.each` is titled "a computed title" · /u,
                },
            ],
            filename: SPEC,
        },
        {
            name: 'A module test is titled with its subject: the one function its module exports.',
            code: "import { test } from 'vitest';\ntest('a', () => {});",
            errors: [{ column: 0, line: 2, messageId: 'noDescribe' }],
            filename: MODULE_TEST,
            output: "import { describe, test } from 'vitest';\ndescribe('judgeLedgers', () => {\ntest('a', () => {});\n});",
        },
        {
            name: 'A title that names neither the subject nor the file is reported on a module test as on a spec.',
            code: "describe('ledger judgement', () => {\n    test('a', () => {});\n});",
            errors: [{ column: 9, line: 1, messageId: 'wrongTitle' }],
            filename: MODULE_TEST,
        },
        {
            name: 'A merged group titled with the subject in another spelling merges like any other.',
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
            output: "describe('LocaleNote', () => {\ntest('a', () => {});\ntest('b', () => {});\n});",
        },
        {
            name: 'A group titled by a name flattens: its tests keep their own titles, the title is not moved.',
            code: "describe('pagination', () => {});\ndescribe(name, () => {\n    test('a', () => {});\n});",
            errors: [{ column: 0, line: 2, messageId: 'severalDescribes' }],
            filename: SPEC,
            output: "describe('pagination', () => {\ntest('a', () => {});\n});",
        },
        {
            name: 'A group holding a test titled by a name, or by nothing, cannot flatten.',
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
            output: "// the page read\nconst page = 1;\n\ndescribe('pagination', () => {\ntest('a', () => {});\ntest('b', () => {});\n});\nconst after = 2;",
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
            name: "A website spec's describe is titled with the page it visits.",
            code: `${PAGE_CHAIN}describe('/articles/:id', () => {\n    test('a', async () => {\n        await website.visit('/articles/42', async () => {});\n    });\n});`,
            filename: PAGE_SPEC,
        },
        {
            name: "An api spec's describe is titled with the route it requests, as a path or with its method.",
            code: "import { api } from '../../api.specification.js';\ndescribe('GET /events/:id', () => {\n    test('a', async () => {\n        await api.get('/events/42');\n    });\n});",
            filename: '/repo/specs/api/events/get/by-id.spec.ts',
        },
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
            name: "The aspect in words is the aspect: 'cli reference' for `cli-reference.spec.ts`.",
            code: "describe('cli reference', () => {\n    test('a', () => {});\n});",
            filename: '/repo/specs/cli/reference/cli-reference.spec.ts',
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
            name: 'A module test titled with its file in words, or with its subject in another spelling, is titled with its subject.',
            code: "describe('route judge', () => {\n    test('a', () => {});\n});\n",
            filename: MODULE_TEST,
        },
        {
            code: "describe('judge ledgers', () => {\n    test('a', () => {});\n});",
            filename: MODULE_TEST,
        },
        {
            name: 'A component titled with its subject in another spelling.',
            code: "describe('<LocaleNote />', () => {\n    beforeAll(seed);\n    test('a', () => {});\n});",
            filename: COMPONENT_TEST,
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
