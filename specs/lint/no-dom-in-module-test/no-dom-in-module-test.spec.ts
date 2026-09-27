import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { lint } from '../lint.specification.js';

describe('no-dom-in-module-test', () => {
    test('accepts the same document where the kind has one', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./_fixtures/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects a DOM global in a module test', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./_fixtures/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            src/widget.test.ts:4:1  jterrazz(no-existence-only-assertion)
                found: \`toBeDefined()\` is this test's only oracle, and passes for almost anything
                why: A test whose ONE assertion is an existence check (\`toBeDefined\`, \`not.toBeNull\`, \`not.toBeUndefined\` or a bare \`toHaveBeenCalled\`) is an error.
                fix: assert the value itself — \`toBe\`/\`toStrictEqual\`, the whole result with \`toMatch\`, or the rows
                read: docs/19-linting.md#no-existence-only-assertion
            src/widget.test.ts:6:18  jterrazz(no-dom-in-module-test)
                found: \`document\` in a module test, where no DOM exists
                why: A module test touches no DOM global: \`document\`, \`window\`, \`navigator\`, \`HTMLElement\` referenced in VALUE position in a \`module\`-role file OUTSIDE \`specs/\` is an error.
                fix: move what renders into a \`.test.tsx\` beside its component, collected by the \`component()\` project
                read: docs/19-linting.md#no-dom-in-module-test
        `);
    });
});
