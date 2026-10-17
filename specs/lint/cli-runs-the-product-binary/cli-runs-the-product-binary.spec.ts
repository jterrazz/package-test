import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('cli-runs-the-product-binary', () => {
    test('rejects when the cli binary is a third-party node_modules/.bin', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./__fixtures__/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/cli/oxlint.specification.ts:9:39  jterrazz(cli-runs-the-product-binary)
                found: \`specification.cli()\` points at a third-party binary under \`node_modules/.bin\`
                why: A \`specification.cli(bin)\` whose binary resolves inside a dependency's \`node_modules/.bin\` tests the third-party tool, not the product command, and is an error (a suppression with a reason is accepted).
                fix: point it at the product's own command (\`bin/<product>\`), or suppress with a reason when the product genuinely is this binary
                read: docs/reference/linting.md#cli-runs-the-product-binary
        `);
    });

    test('stays silent on the product command wrapper', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./__fixtures__/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });
});
