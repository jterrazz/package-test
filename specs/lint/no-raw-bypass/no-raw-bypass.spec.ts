import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { lint } from '../lint.specification.js';

describe('no-raw-bypass', () => {
    test('rejects a .raw substring assertion', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./_fixtures/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            scenario.test.ts:9:5  jterrazz(no-raw-bypass)
                found: \`expect(x.raw).toContain(…)\` asserts on the stream as captured
                why: \`expect(x.raw).toContain\` compares the stream as it was captured → error.
                fix: compare \`x.text\` — ANSI stripped, \`transform\` applied, the text an expectation compares
                read: docs/19-linting.md#no-raw-bypass
        `);
    });

    test('stays silent on the comparable text', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./_fixtures/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });
});
