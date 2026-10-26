import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('literate-runner-exists', () => {
    test('accepts a literate door that resolves', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./__fixtures__/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects a literate door pointing at no file', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./__fixtures__/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            studio.config.ts:5:40  jterrazz(literate-runner-exists)
                found: \`literate.runner\` names \`./specs/cli/cli.specification.ts\`, which resolves to no file
                why: \`literate.runner\`, resolved from the config directory, names a file that exists.
                fix: point it at the \`*.specification.ts\` exporting the runner the documents run on, \`./specs/cli/cli.specification.ts\` by convention
                read: docs/reference/linting.md#literate-runner-exists
        `);
    });
});
