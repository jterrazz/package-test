import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('no-sampled-value-in-test', () => {
    test('accepts a Given that pins every instant', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./_fixtures/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects an instant sampled into the Given', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./_fixtures/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            scenario.test.ts:8:21  jterrazz(no-sampled-value-in-test)
                found: time or randomness sampled in the test
                why: A sampled value anywhere in a test callback is an error — the wider net around \`no-sampled-value-in-expectation\`, silent where \`no-sampled-value-in-expectation\` already refuses, on a name built in a template literal, and on a \`new Date()\` or \`Date.now()\` after a \`using _ = clock.at(<instant>)\` or \`clock.run(<instant>)\` in the same block, where the reading is the pinned instant — a pin fakes \`Date\` alone, so \`Math.random()\`, \`randomUUID()\` and \`performance.now()\` stay samples under it, and an argument-less \`clock.run()\` pins no instant.
                fix: pin the time with \`clock.at(…)\`/\`clock.advance(…)\`, or absorb the value with a token in the expectation
                read: docs/reference/linting.md#no-sampled-value-in-test
        `);
    });
});
