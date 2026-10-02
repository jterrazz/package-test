import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('no-raw-env-write', () => {
    test('accepts the self-restoring stub', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./_fixtures/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects a raw process.env assignment in a test', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./_fixtures/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            scenario.test.ts:8:5  jterrazz(no-raw-env-write)
                found: the test writes the process environment directly
                why: A test writes the process environment through \`vi.stubEnv\` alone: a raw assignment onto a variable of it (named or computed), a replacement of \`process.env\` itself, and a \`delete\` of one of its variables are each an error; a \`*.specification.ts(x)\` is out of reach by role.
                fix: write \`vi.stubEnv('<NAME>', '<value>')\`, which restores itself; a CLI default belongs to \`specification.cli({ defaults })\`
                read: docs/19-linting.md#no-raw-env-write
        `);
    });
});
