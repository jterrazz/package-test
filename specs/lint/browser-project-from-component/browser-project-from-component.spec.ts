import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('browser-project-from-component', () => {
    test('accepts the project the helper builds', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./_fixtures/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects a hand-rolled browser project', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./_fixtures/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            vitest.config.ts:1:1  jterrazz(vitest-config-from-define-spec-config)
                found: a vitest config that does not default-export \`defineSpecConfig(…)\`
                why: A \`vitest.config.*\` default-exports \`defineSpecConfig(...)\`; the call is resolved through an \`export default <Identifier>\` declarator, through a \`satisfies\`/\`as\` annotation, and through one \`mergeConfig(defineSpecConfig(…), …)\` — vitest’s own way of layering over the preset.
                fix: wrap it: \`export default defineSpecConfig({ … })\`, from \`@jterrazz/test/vitest\` — the budgets, the artefact directory and the ground exclusion are the preset's
                read: docs/19-linting.md#vitest-config-from-define-spec-config
            vitest.config.ts:6:21  jterrazz(browser-project-from-component)
                found: a hand-rolled \`browser:\` block in a vitest config
                why: A browser project comes from \`component()\`: in a vitest config, a \`browser\` key under \`test\` that is not inside a \`component(...)\` call is an error.
                fix: replace it with \`component({ vite: './vite.config.ts' })\`, which sets the provider, the worker and the pipeline
                read: docs/19-linting.md#browser-project-from-component
        `);
    });
});
