import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('literate-specification-exists', () => {
    test('accepts a literate door that resolves', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./_fixtures/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects a literate door pointing at no file', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./_fixtures/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            vitest.config.ts:5:38  jterrazz(literate-specification-exists)
                found: \`literate.specification\` names \`./specs/cli/cli.specification.ts\`, which resolves to no file
                why: \`literate.specification\`, resolved from the config directory, names a file that exists.
                fix: point it at the \`*.specification.ts\` exporting the runner the documents run on — \`./specs/cli/cli.specification.ts\` by convention
                read: docs/19-linting.md#literate-specification-exists
        `);
    });
});
