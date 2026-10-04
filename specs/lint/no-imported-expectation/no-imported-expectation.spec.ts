import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('no-imported-expectation', () => {
    test("a typed helper the test calls builds the test's own expectation", async () => {
        // Given - the built tree
        const result = await lint.fixture(directory('./_fixtures/built/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('an expectation imported from another module is refused where the test hands it over', async () => {
        // Given - the imported tree
        const result = await lint.fixture(directory('./_fixtures/imported/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/api/events/list/pagination.spec.ts:12:41  jterrazz(no-imported-expectation)
                found: the expectation \`FIRST_PAGE\`, imported from "../pages.js"
                why: A spec imports no expectation: a name imported from another module of its specs tree — neither its \`*.specification\` runner nor a module under \`stubs/\` — and handed to a matcher as the expected value, itself or a member of it, is an error at the argument.
                fix: write the expected value in this test — in place, or \`file(…)\` when several tests of this leaf share it — and stop importing \`FIRST_PAGE\`
                read: docs/reference/linting.md#no-imported-expectation
        `);
    });
});
