import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('no-existence-only-assertion', () => {
    test('accepts an assertion that says what came back', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./__fixtures__/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects a test whose one assertion is an existence check', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./__fixtures__/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            __tests__/scenario.test.ts:6:1  jterrazz(no-existence-only-assertion)
                found: \`toBeDefined()\` is this test's only oracle, and passes for almost anything
                why: A test whose ONE assertion is an existence check (\`toBeDefined\`, \`not.toBeNull\`, \`not.toBeUndefined\` or a bare \`toHaveBeenCalled\`) is an error.
                fix: assert the value itself: \`toBe\`/\`toStrictEqual\`, the whole result with \`toMatch\`, or the rows
                read: docs/reference/linting.md#no-existence-only-assertion
        `);
    });
});
