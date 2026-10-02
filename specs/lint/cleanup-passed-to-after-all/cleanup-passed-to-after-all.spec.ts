import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('cleanup-passed-to-after-all', () => {
    test('accepts a specification file calling afterAll(cleanup)', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./_fixtures/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects a specification file that never registers cleanup with afterAll', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./_fixtures/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/cli/leak.specification.ts:3:14  jterrazz(cleanup-passed-to-after-all)
                found: \`cleanup\` is destructured and never handed to \`afterAll\`
                why: The specification file passes \`cleanup\` to \`afterAll\`; a \`cleanup\` destructured but never handed over is an error.
                fix: add \`afterAll(cleanup);\` at the end of the specification file
                read: docs/19-linting.md#cleanup-passed-to-after-all
        `);
    });
});
