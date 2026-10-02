import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('vitest-config-from-define-spec-config', () => {
    test('accepts a config that starts from the preset', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./_fixtures/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects a config that does not start from the preset', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./_fixtures/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            vitest.config.ts:3:1  jterrazz(vitest-config-from-define-spec-config)
                found: a vitest config that does not default-export \`defineSpecConfig(…)\`
                why: A \`vitest.config.*\` default-exports \`defineSpecConfig(...)\`; the call is resolved through an \`export default <Identifier>\` declarator, through a \`satisfies\`/\`as\` annotation, and through one \`mergeConfig(defineSpecConfig(…), …)\` — vitest’s own way of layering over the preset.
                fix: wrap it: \`export default defineSpecConfig({ … })\`, from \`@jterrazz/test/vitest\` — the budgets, the artefact directory and the ground exclusion are the preset's
                read: docs/24-linting.md#vitest-config-from-define-spec-config
            vitest.config.ts:5:19  jterrazz(include-points-at-a-folder)
                found: \`src/**/*.test.ts\` collects nothing: the folder \`src\` does not exist
                why: An \`include\` glob of a PROJECT — an object under \`test\` or in \`projects\`, never \`optimizeDeps.include\` and its kin — whose static prefix (the segments before the first wildcard, brace or bracket), resolved from the config, is not a directory is an error.
                fix: point the glob at the folder that holds the suite, or delete it
                read: docs/24-linting.md#include-points-at-a-folder
        `);
    });
});
