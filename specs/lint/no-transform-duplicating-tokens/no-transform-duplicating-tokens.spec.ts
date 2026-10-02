import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('no-transform-duplicating-tokens', () => {
    test('rejects when a transform only rewrites output into known tokens', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./_fixtures/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/cli/tf.specification.ts:6:5  jterrazz(no-transform-duplicating-tokens)
                found: a \`transform\` that only rewrites output into token literals
                why: A \`transform\` that only rewrites into equivalents of the standard tokens duplicates the grammar → error.
                fix: delete the transform and write the tokens in the expectation; \`transform\` is for noise no token covers
                read: docs/24-linting.md#no-transform-duplicating-tokens
        `);
    });

    test('stays silent for a transform covering real applicative noise', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./_fixtures/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });
});
