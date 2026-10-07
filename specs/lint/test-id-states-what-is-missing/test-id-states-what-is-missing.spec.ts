import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('test-id-states-what-is-missing', () => {
    test('accepts the hatch when the line above says what the element lacks', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./__fixtures__/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('refuses a testId() that states nothing about the element', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./__fixtures__/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/website/home/subscribe.spec.ts:10:15  jterrazz(scenario-ends-settled)
                found: a scenario that acts and ends without reading the screen
                why: A scenario under \`specs/\` that ACTS (\`click\`, \`fill\`, \`select\`, \`check\`, \`press\`, \`tap\`, \`rerender\`) on the visitor it was handed ends on \`visitor.see(…)\`, \`visitor.gone(…)\` or \`visitor.unmount()\` — through the block, branch, loop or \`.then()\` it ends in.
                fix: end it on \`visitor.see(<what the action produced>)\` or \`visitor.gone(<what it removed>)\`
                read: docs/reference/linting.md#scenario-ends-settled
            specs/website/home/subscribe.spec.ts:10:29  jterrazz(test-id-states-what-is-missing)
                found: \`testId()\` with no line saying what the element lacks
                why: In a test file, a scenario's elements are user-facing (\`button\`, \`link\`, \`field\`, \`heading\`, \`content\`; on mobile \`button\`, \`field\`, \`content\`).
                fix: name the element with \`button()\`/\`link()\`/\`field()\`/\`heading()\`/\`content()\`, or write \`// testId: <no accessible name|no role|…>\` on this line or the one above
                read: docs/reference/linting.md#test-id-states-what-is-missing
        `);
    });
});
