import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('when-between-given-and-then', () => {
    test('accepts a When between Given and Then, and a test without one', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./_fixtures/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects a When written outside the two mandatory markers', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./_fixtures/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            scenario.test.ts:6:1  jterrazz(when-between-given-and-then)
                found: \`// When -\` written before \`// Given -\`
                why: A \`// When -\` marker is optional; written, it sits after \`// Given -\` and before \`// Then -\`.
                fix: move it above the action it narrates, between Given and Then — or delete it when the chain is the action
                read: docs/24-linting.md#when-between-given-and-then
            scenario.test.ts:14:1  jterrazz(when-between-given-and-then)
                found: \`// When -\` written after \`// Then -\`
                why: A \`// When -\` marker is optional; written, it sits after \`// Given -\` and before \`// Then -\`.
                fix: move it above the action it narrates, between Given and Then — or delete it when the chain is the action
                read: docs/24-linting.md#when-between-given-and-then
        `);
    });
});
