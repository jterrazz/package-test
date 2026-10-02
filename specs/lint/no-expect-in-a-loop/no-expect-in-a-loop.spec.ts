import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('no-expect-in-a-loop', () => {
    test('accepts a collection compared whole', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./_fixtures/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects an assertion inside a loop', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./_fixtures/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            scenario.test.ts:11:9  jterrazz(no-expect-in-a-loop)
                found: \`expect()\` inside a for…of, which runs it once per element — and not at all over none
                why: An \`expect()\` in a test is not called inside a loop — a \`for\`, a \`for…of\`, a \`for…in\`, a \`while\`, a \`do…while\` — nor inside the callback of an array iteration — \`forEach\`, \`map\`, \`flatMap\`, \`filter\`, \`every\`, \`some\`, \`find\`, \`reduce\` — in the same function: a loop runs its assertion once per element, and not at all over an empty collection.
                fix: compare the whole collection in one assertion — \`expect(rows.map(…)).toStrictEqual([…])\` — or state each case with \`test.each\`
                read: docs/19-linting.md#no-expect-in-a-loop
        `);
    });
});
