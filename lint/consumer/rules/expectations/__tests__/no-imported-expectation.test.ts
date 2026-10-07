import { ruleTester } from '@jterrazz/test';

import { noImportedExpectation } from '../no-imported-expectation.js';

const SPEC = '/repo/specs/api/events/list/pagination.spec.ts';

ruleTester().run('no-imported-expectation', noImportedExpectation, {
    invalid: [
        {
            name: 'A module beside the test, and a specification file of data, are expectations written elsewhere.',
            code: "import { PAGE } from './pages.js';\nimport { ROWS } from '../rows.specification.json';\ntest('a', () => { expect(a).toBe(PAGE); expect(b).toBe(ROWS); });",
            errors: [
                { column: 33, line: 3, messageId: 'imported' },
                { column: 55, line: 3, messageId: 'imported' },
            ],
            filename: SPEC,
        },
        {
            name: 'An expectation written in another module.',
            code: "import { FIRST_PAGE } from '../__setup__/pages.js';\ntest('a', () => { expect(result.response).toMatch(FIRST_PAGE); });",
            errors: [{ column: 50, line: 2, messageId: 'imported' }],
            filename: SPEC,
        },
        {
            name: 'A member of one is the same expectation.',
            code: "import { pages } from '../../expectations.js';\ntest('a', () => { expect(result.json).toMatch(pages.first); });",
            errors: [{ column: 46, line: 2, messageId: 'imported' }],
            filename: SPEC,
        },
    ],
    valid: [
        {
            name: 'A runner named without its extension, and an imported name handed to a call that asserts nothing.',
            code: "import { api } from '../../api.specification';\nimport { PAGE } from './pages.js';\ntest('a', () => { expect(a).toBe(api); render(PAGE); });",
            filename: SPEC,
        },
        {
            name: 'A helper of the specs tree is no spec.',
            code: "import { PAGE } from './pages.js';\nexpect(a).toBe(PAGE);",
            filename: '/repo/specs/api/__setup__/check.ts',
        },
        {
            name: 'A spec in no specs tree is out of reach.',
            code: "import { PAGE } from './pages.js';\ntest('a', () => { expect(a).toBe(PAGE); });",
            filename: '/repo/lib/pagination.spec.ts',
        },
        {
            name: "A helper is called: what it builds is the test's own.",
            code: "import { page } from '../__setup__/pages.js';\ntest('a', () => { expect(result.json).toMatch(page(1)); });",
            filename: SPEC,
        },
        {
            name: 'The runner and the stubs are imported by design.',
            code: "import { api } from '../../api.specification.js';\ntest('a', () => { expect(a).toBe(api); });",
            filename: SPEC,
        },
        {
            code: "import { quote } from '../stubs/quotes.stubs.js';\ntest('a', () => { expect(a).toBe(quote); });",
            filename: SPEC,
        },
        {
            name: "The product's own data, outside the specs tree, is the subject's.",
            code: "import manifest from '../../../../../package.json' with { type: 'json' };\ntest('a', () => { expect(result.stdout.text).toBe(manifest.version); });",
            filename: SPEC,
        },
        {
            code: "import { DEFAULT_PAGE } from '../../../../../src/events/defaults.js';\ntest('a', () => { expect(result.json).toMatch(DEFAULT_PAGE); });",
            filename: SPEC,
        },
        {
            name: 'A package is no expectation of this repository.',
            code: "import { value } from 'some-package';\ntest('a', () => { expect(a).toBe(value); });",
            filename: SPEC,
        },
        {
            name: 'A module test is not a spec.',
            code: "import { X } from './x.js';\ntest('a', () => { expect(a).toBe(X); });",
            filename: '/repo/src/x.test.ts',
        },
    ],
});
