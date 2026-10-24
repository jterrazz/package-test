import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('no-unknown-constructor', () => {
    test('a tree calling a known constructor passes', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./__fixtures__/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects specification.app, which is none of the seven constructors', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./__fixtures__/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/api/app.specification.ts:5:39  jterrazz(no-unknown-constructor)
                found: \`specification.app\` is no constructor
                why: Seven constructors and only seven: \`specification.api()\`, \`specification.job()\`, \`specification.cli(bin)\`, \`specification.integration()\`, \`specification.website()\`, \`specification.mobile()\`, \`specification.lint()\`.
                fix: call \`specification.api()\`, \`.job()\`, \`.cli(bin)\`, \`.integration()\`, \`.website()\`, \`.mobile()\` or \`.lint()\`; a rendered unit is the \`component\` chain
                read: docs/reference/linting.md#no-unknown-constructor
        `);
    });
});
