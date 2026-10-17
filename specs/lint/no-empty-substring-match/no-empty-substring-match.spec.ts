import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('no-empty-substring-match', () => {
    test('rejects an empty substring match on a plain string', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./__fixtures__/violation/')).run();

        // Then - the finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/cli/build/build.test.ts:9:5  jterrazz(no-empty-substring-match)
                found: \`toMatch('')\` on a plain string, where it is vitest's substring match and holds for any text
                why: \`toMatch('')\`, or \`toMatch\` of an empty template literal, on a plain string (a stream's \`.text\`, \`.raw\` or a file's \`.content\`) is vitest's substring match, which holds for any text, and is an error.
                fix: compare the string whole, \`expect(<result>.stdout.text).toBe('')\`, or hand the accessor itself to \`toMatch\` so the empty value is the one update mode records
                read: docs/reference/linting.md#no-empty-substring-match
        `);
    });

    test('stays silent on a text compared whole and an accessor left to update mode', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./__fixtures__/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });
});
