import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('given-in-the-test', () => {
    test('accepts a Given each test calls for itself', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./_fixtures/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects a Given built in a hook', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./_fixtures/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            scenario.test.ts:7:1  jterrazz(given-in-the-test)
                found: \`beforeEach\` moves the Given out of the tests
                why: A \`beforeEach\`/\`beforeAll\` in a test file is an error: the Given is built in the test.
                fix: write the Given in each test — a shared value is a function each test calls, and \`clock.at()\` restores itself
                read: docs/19-linting.md#given-in-the-test
        `);
    });
});
