import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('no-expect-in-scenario', () => {
    test('accepts a pure scenario asserting on the result', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./__fixtures__/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects an expect() inside a visit scenario', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./__fixtures__/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/website/home/subscribe.test.ts:12:9  jterrazz(no-expect-in-scenario)
                found: \`expect()\` inside a scenario
                why: A scenario (\`.visit()\` on website, \`.open()\` on mobile, \`.render()\` on component) is the When: the visitor acts and the capture reflects the settled state; no \`expect()\` in the callback — assertions live in the Then, on the returned result.
                fix: move the assertion after the scenario, onto the result it returns
                read: docs/reference/linting.md#no-expect-in-scenario
            specs/website/home/subscribe.test.ts:12:9  jterrazz(scenario-ends-settled)
                found: a scenario that acts and ends without reading the screen
                why: A scenario under \`specs/\` that ACTS (\`click\`, \`fill\`, \`select\`, \`check\`, \`press\`, \`tap\`, \`rerender\`) on the visitor it was handed ends on \`visitor.see(…)\`, \`visitor.gone(…)\` or \`visitor.unmount()\` — through the block, branch, loop or \`.then()\` it ends in.
                fix: end it on \`visitor.see(<what the action produced>)\` or \`visitor.gone(<what it removed>)\`
                read: docs/reference/linting.md#scenario-ends-settled
        `);
    });
});
