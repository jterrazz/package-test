import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('no-simulated-dom', () => {
    test('accepts a test that needs no environment at all', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./__fixtures__/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects a simulated-DOM pragma in a test file', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./__fixtures__/violation/')).run();

        // hazard: the pragma's `@` is spelled `\u0040` below: vitest takes the environment pragma from
        // anywhere in a test file's text, and would start this spec under happy-dom
        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            src/__tests__/widget.test.ts:2:1  jterrazz(no-simulated-dom)
                found: \`\u0040vitest-environment happy-dom\` simulates a browser
                why: A test file declares no simulated DOM: the \`\u0040vitest-environment happy-dom|jsdom\` pragma is an error.
                fix: delete the pragma, and write the rendered test as a \`.test.tsx\` in the \`__tests__/\` of its component’s folder, collected by the \`component()\` project
                read: docs/reference/linting.md#no-simulated-dom
        `);
    });
});
