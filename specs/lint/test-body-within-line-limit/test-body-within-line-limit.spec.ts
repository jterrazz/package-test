import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('test-body-within-line-limit', () => {
    test('a test whose body spans sixty lines of gestures passes', async () => {
        // Given - the short tree
        const result = await lint.fixture(directory('./_fixtures/short/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('twenty lines of gestures and a ninety-line inline expectation pass — the claim is not counted', async () => {
        // Given - the claim tree
        const result = await lint.fixture(directory('./_fixtures/claim/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('a test whose body spans more than sixty lines of gestures is refused at its function', async () => {
        // Given - the long tree
        const result = await lint.fixture(directory('./_fixtures/long/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/api/events/list/pagination.spec.ts:6:43  jterrazz(test-body-within-line-limit)
                found: a test body of 61 lines of gestures, over 60 — the lines of a \`toMatch(<value>)\` argument are not counted
                why: A test body spans at most 60 lines of gestures — the function a \`test(…)\`/\`it(…)\` runs, from the line it opens on to the line it closes on, blank lines and comments included, less the lines a \`toMatch(<value>)\` argument holds past the one it opens on: the claim is capped by \`ground-shared-or-inline\`, not here; a longer one is refused at the function.
                fix: split it into one test per behaviour, or move a long Given into a function the test calls
                read: docs/reference/linting.md#test-body-within-line-limit
        `);
    });
});
