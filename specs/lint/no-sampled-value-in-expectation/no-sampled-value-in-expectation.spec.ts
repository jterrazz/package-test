import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('no-sampled-value-in-expectation', () => {
    test('accepts an oracle the test states', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./__fixtures__/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects an oracle that samples the clock', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./__fixtures__/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            __tests__/scenario.test.ts:10:24  jterrazz(no-sampled-value-in-expectation)
                found: a sampled value under \`expect\`
                why: No sampled value under an oracle: \`new Date()\` (no argument), \`Date.now()\`, \`performance.now()\`, \`Math.random()\` and \`randomUUID()\` are an error as a direct argument of \`expect\` or of its matcher, and anywhere inside a structural matcher's expected shape.
                fix: pin it with \`clock.at('2026-01-01T00:00:00Z')\`, or match it with an \`iso8601\` token or \`match.uuid\`
                read: docs/reference/linting.md#no-sampled-value-in-expectation
        `);
    });
});
