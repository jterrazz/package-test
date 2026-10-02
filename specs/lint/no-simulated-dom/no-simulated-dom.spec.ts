import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('no-simulated-dom', () => {
    test('accepts a test that needs no environment at all', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./_fixtures/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects a simulated-DOM pragma in a test file', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./_fixtures/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            src/widget.test.ts:2:1  jterrazz(no-simulated-dom)
                found: \`@vitest-environment happy-dom\` simulates a browser
                why: A test file declares no simulated DOM: the \`@vitest-environment happy-dom|jsdom\` pragma is an error.
                fix: delete the pragma, and write the rendered test as a \`.test.tsx\` beside its component, collected by the \`component()\` project
                read: docs/24-linting.md#no-simulated-dom
        `);
    });
});
