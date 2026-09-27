import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { lint } from '../lint.specification.js';

describe('no-unknown-constructor', () => {
    test('accepts the three known constructors', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./_fixtures/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects specification.app - only api, job and cli exist', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./_fixtures/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/api/app.specification.ts:5:39  jterrazz(no-unknown-constructor)
                found: \`specification.app\` is no constructor
                why: Seven constructors and only seven: \`specification.api()\`, \`specification.job()\`, \`specification.cli(bin)\`, \`specification.integration()\`, \`specification.website()\`, \`specification.mobile()\`, \`specification.lint()\`.
                fix: call \`specification.api()\`, \`.job()\`, \`.cli(bin)\`, \`.integration()\`, \`.website()\` or \`.mobile()\` — a rendered unit is the \`component\` chain
                read: docs/19-linting.md#no-unknown-constructor
        `);
    });
});
