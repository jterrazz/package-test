import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('include-points-at-a-folder', () => {
    test('accepts an include rooted in a folder that exists', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./_fixtures/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects an include whose folder does not exist', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./_fixtures/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            vitest.config.ts:5:32  jterrazz(include-points-at-a-folder)
                found: \`specs/api/**/*.spec.ts\` collects nothing: the folder \`specs/api\` does not exist
                why: An \`include\` glob of a PROJECT — an object under \`test\` or in \`projects\`, never \`optimizeDeps.include\` and its kin — whose static prefix (the segments before the first wildcard, brace or bracket), resolved from the config, is not a directory is an error.
                fix: point the glob at the folder that holds the suite, or delete it
                read: docs/24-linting.md#include-points-at-a-folder
        `);
    });
});
