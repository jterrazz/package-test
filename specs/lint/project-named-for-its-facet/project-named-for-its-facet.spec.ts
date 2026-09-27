import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { lint } from '../lint.specification.js';

describe('project-named-for-its-facet', () => {
    test('accepts a project named for the facet it collects', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./_fixtures/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects a facet root collected under another name', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./_fixtures/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            vitest.config.ts:5:32  jterrazz(include-points-at-a-folder)
                found: \`specs/api/**/*.spec.ts\` matches no file, though its folder exists
                why: An \`include\` glob of a PROJECT — an object under \`test\` or in \`projects\`, never \`optimizeDeps.include\` and its kin — whose static prefix (the segments before the first wildcard, brace or bracket), resolved from the config, is not a directory is an error.
                fix: point the glob at the suffix the files carry now (\`.spec.ts\` after a rename), or delete it
                read: docs/19-linting.md#include-points-at-a-folder
            vitest.config.ts:5:59  jterrazz(project-named-for-its-facet)
                found: the project \`http\` collects \`specs/api/**\`
                why: A project literal collecting \`specs/<facet>/\` is named \`<facet>\`, and one named for a facet is rooted there; \`unit\` collects outside \`specs/\`.
                fix: name it \`api\`, so \`--project api\` means the same in every repository
                read: docs/19-linting.md#project-named-for-its-facet
        `);
    });
});
