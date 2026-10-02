import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as preset } from '../preset-lint.specification.js';

describe('fixtures-imported-by-tests-only', () => {
    test('a module test importing its sibling fixtures module passes', async () => {
        // Given - the compliant tree
        const result = await preset.fixture(directory('./_fixtures/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('production code importing a fixtures module is refused', async () => {
        // Given - the violation tree
        const result = await preset.fixture(directory('./_fixtures/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            src/widget/widget.ts:1:28  architecture(fixtures-imported-by-tests-only)
                found: \`src/widget/widget.ts\` imports \`src/widget/widget.fixtures.ts\`
                why: A \`*.fixtures.ts\` is importable only from a test file.
                fix: import it from a \`*.test.ts\` only, or move what the file needs into a module of its own
                read: docs/19-linting.md#fixtures-imported-by-tests-only
        `);
    });
});
