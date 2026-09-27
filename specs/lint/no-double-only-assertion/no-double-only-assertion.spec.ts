import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { lint } from '../lint.specification.js';

describe('no-double-only-assertion', () => {
    test('accepts a call log beside what the subject produced', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./_fixtures/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects a module test whose whole proof is a call log', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./_fixtures/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            scenario.test.ts:6:1  jterrazz(no-double-only-assertion)
                found: every assertion reads a double this test built
                why: A module test whose every assertion reads the call log of a double it built itself (\`mockOf\`, \`vi.fn\`, \`vi.spyOn\`) is an error.
                fix: assert the value the subject returned, or the state it left
                read: docs/19-linting.md#no-double-only-assertion
        `);
    });
});
