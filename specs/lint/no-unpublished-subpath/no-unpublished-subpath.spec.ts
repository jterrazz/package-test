import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as preset } from '../preset-lint.specification.js';

describe('no-unpublished-subpath', () => {
    test('accepts the single public entry point and every published subpath', async () => {
        // Given - the compliant tree
        const result = await preset.fixture(directory('./_fixtures/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects an @jterrazz/test subpath import', async () => {
        // Given - the violation tree
        const result = await preset.fixture(directory('./_fixtures/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/app/widget/widget.test.ts:3:24  architecture(no-unpublished-subpath)
                found: \`specs/app/widget/widget.test.ts\` imports \`@jterrazz/test/mock\`
                why: Everything is imported from \`@jterrazz/test\`; an import of \`@jterrazz/test/<subpath>\` is an error, except the subpaths the package's \`exports\` map publishes — the entries are \`.\`, \`./vitest\`, \`./oxlint\` and \`./schema\`, and the three named ones are exempt everywhere.
                fix: import from "@jterrazz/test"; the published subpaths are @jterrazz/test/config, @jterrazz/test/oxlint, @jterrazz/test/schema, @jterrazz/test/vitest
                read: docs/reference/linting.md#no-unpublished-subpath
        `);
    });
});
