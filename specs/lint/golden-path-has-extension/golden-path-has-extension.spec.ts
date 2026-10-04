import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('golden-path-has-extension', () => {
    test('accepts extensions and directory-tree snapshots', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./_fixtures/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects a toMatch fixture name without its extension', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./_fixtures/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/app/widget/widget.test.ts:12:40  jterrazz(golden-path-has-extension)
                found: \`toMatch(file("./_expected/help"))\` names a golden with no extension
                why: A golden \`file()\`'s path carries its extension (\`toMatch(file('./_expected/help.txt'))\`, \`'./_expected/<case>.aria.yaml'\` for an ARIA tree); a golden file with no extension is an error.
                fix: add the extension to the path (\`"./_expected/help.txt"\`), or compare a tree with \`toMatch(directory("./_expected/<name>/"))\`
                read: docs/reference/linting.md#golden-path-has-extension
        `);
    });
});
