import { asOxlintRule, ruleTester } from '../../../engine/testing/rule-tester.fixtures.js';
import { noImportedExpectation } from './no-imported-expectation.js';

const SPEC = '/repo/specs/api/events/list/pagination.spec.ts';

ruleTester().run('no-imported-expectation', asOxlintRule(noImportedExpectation), {
    invalid: [
        // An expectation written in another module.
        {
            code: "import { FIRST_PAGE } from '../_setup/pages.js';\ntest('a', () => { expect(result.response).toMatch(FIRST_PAGE); });",
            errors: [{ messageId: 'imported' }],
            filename: SPEC,
        },
        // A member of one is the same expectation.
        {
            code: "import { pages } from '../../expectations.js';\ntest('a', () => { expect(result.json).toMatch(pages.first); });",
            errors: [{ messageId: 'imported' }],
            filename: SPEC,
        },
    ],
    valid: [
        // A helper is called: what it builds is the test's own.
        {
            code: "import { page } from '../_setup/pages.js';\ntest('a', () => { expect(result.json).toMatch(page(1)); });",
            filename: SPEC,
        },
        // The runner and the stubs are imported by design.
        {
            code: "import { api } from '../../api.specification.js';\ntest('a', () => { expect(a).toBe(api); });",
            filename: SPEC,
        },
        {
            code: "import { quote } from '../stubs/quotes.stubs.js';\ntest('a', () => { expect(a).toBe(quote); });",
            filename: SPEC,
        },
        // The product's own data, outside the specs tree, is the subject's.
        {
            code: "import manifest from '../../../../../package.json' with { type: 'json' };\ntest('a', () => { expect(result.stdout.text).toBe(manifest.version); });",
            filename: SPEC,
        },
        {
            code: "import { DEFAULT_PAGE } from '../../../../../src/events/defaults.js';\ntest('a', () => { expect(result.json).toMatch(DEFAULT_PAGE); });",
            filename: SPEC,
        },
        // A package is no expectation of this repository.
        {
            code: "import { value } from 'some-package';\ntest('a', () => { expect(a).toBe(value); });",
            filename: SPEC,
        },
        // A module test is not a spec.
        {
            code: "import { X } from './x.js';\ntest('a', () => { expect(a).toBe(X); });",
            filename: '/repo/src/x.test.ts',
        },
    ],
});
