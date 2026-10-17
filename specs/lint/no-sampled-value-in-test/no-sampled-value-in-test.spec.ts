import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('no-sampled-value-in-test', () => {
    test('accepts a Given that pins every instant', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./__fixtures__/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects an instant sampled into the Given', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./__fixtures__/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            __tests__/scenario.test.ts:8:21  jterrazz(no-sampled-value-in-test)
                found: time or randomness sampled in the test
                why: A sampled value anywhere in a test callback is an error.
                fix: pin the time with \`clock.at(...)\`/\`clock.advance(...)\`, or absorb the value with a token in the expectation
                read: docs/reference/linting.md#no-sampled-value-in-test
        `);
    });
});
