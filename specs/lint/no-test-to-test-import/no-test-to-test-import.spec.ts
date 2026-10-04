import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as preset } from '../preset-lint.specification.js';

describe('no-test-to-test-import', () => {
    test('accepts importing a `_setup/` module instead', async () => {
        // Given - the compliant tree
        const result = await preset.fixture(directory('./_fixtures/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects a test file importing another test file', async () => {
        // Given - the violation tree
        const result = await preset.fixture(directory('./_fixtures/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/app/widget/widget.test.ts:3:28  architecture(no-test-to-test-import)
                found: \`specs/app/widget/widget.test.ts\` imports \`./other.test.js\`
                why: A test file never imports another test file.
                fix: under \`specs/\`, move what both read into the \`_setup/\` of the lowest folder they share; under \`src/\`, into a sibling \`<file>.fixtures.ts\` for typed input data
                read: docs/reference/linting.md#no-test-to-test-import
        `);
    });
});
