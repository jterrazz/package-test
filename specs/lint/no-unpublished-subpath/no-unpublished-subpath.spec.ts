import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as preset } from '../preset-lint.specification.js';

describe('no-unpublished-subpath', () => {
    test('accepts the single public entry point and every published subpath', async () => {
        // Given - the compliant tree
        const result = await preset.fixture(directory('./__fixtures__/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects an @jterrazz/test subpath import', async () => {
        // Given - the violation tree
        const result = await preset.fixture(directory('./__fixtures__/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/app/widget/widget.test.ts:3:24  architecture(no-unpublished-subpath)
                found: \`specs/app/widget/widget.test.ts\` imports \`@jterrazz/test/mock\`
                why: An import of \`@jterrazz/test/<subpath>\` is an error unless the package's \`exports\` map publishes the subpath: \`./services\` and \`./stubs\` for a spec, beside the root, and \`./vitest\`, \`./config\`, \`./oxlint\` and \`./schema\` for the tools.
                fix: import from "@jterrazz/test"; the published subpaths are @jterrazz/test/config, @jterrazz/test/oxlint, @jterrazz/test/schema, @jterrazz/test/services, @jterrazz/test/stubs, @jterrazz/test/vitest
                read: docs/reference/linting.md#no-unpublished-subpath
        `);
    });
});
