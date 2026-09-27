import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { lint } from '../lint.specification.js';

describe('expected-constant-shared', () => {
    test('a file-level expectation two tests read is shared, and stays', async () => {
        // Given - the two-readers tree
        const result = await lint.fixture(directory('./_fixtures/two-readers/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('a file-level expectation one test reads is refused at its declaration', async () => {
        // Given - the one-reader tree
        const result = await lint.fixture(directory('./_fixtures/one-reader/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/api/events/list/pagination.spec.ts:5:7  jterrazz(expected-constant-shared)
                found: the expectation \`FIRST_PAGE\`, declared for the file and read by one test
                why: A file-level \`const\` a spec hands to a matcher as the expected value serves two tests or more; read by one test, it is an error at its declaration.
                fix: write its value in place, in the matcher the test hands it to, and delete \`FIRST_PAGE\` — \`make fix\` inlines it
                read: docs/19-linting.md#expected-constant-shared
        `);
    });
});
