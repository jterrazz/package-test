import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('no-redundant-root', () => {
    test('rejects when root points at the directory the walk-up already finds', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./_fixtures/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/cli/rooted.specification.ts:6:5  jterrazz(no-redundant-root)
                found: \`root: "../.."\` names the directory the walk already finds
                why: A \`root\` pointing at the directory the automatic walk would have found is redundant → error.
                fix: delete the \`root\` option
                read: docs/24-linting.md#no-redundant-root
        `);
    });

    test('stays silent without a root override', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./_fixtures/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });
});
