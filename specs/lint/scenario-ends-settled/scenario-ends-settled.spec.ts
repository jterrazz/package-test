import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('scenario-ends-settled', () => {
    test('accepts a scenario that names what the action produced', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./_fixtures/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects a scenario that ends on the action', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./_fixtures/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/website/posts/table.spec.ts:9:15  jterrazz(scenario-ends-settled)
                found: a scenario that acts and ends without reading the screen
                why: A scenario under \`specs/\` that ACTS (\`click\`, \`fill\`, \`select\`, \`check\`, \`press\`, \`tap\`, \`rerender\`) on the visitor it was handed ends on \`visitor.see(…)\`, \`visitor.gone(…)\` or \`visitor.unmount()\` — through the block, branch, loop or \`.then()\` it ends in.
                fix: end it on \`visitor.see(<what the action produced>)\` or \`visitor.gone(<what it removed>)\`
                read: docs/reference/linting.md#scenario-ends-settled
        `);
    });
});
