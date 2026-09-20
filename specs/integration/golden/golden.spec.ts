import { describe, expect, test } from 'vitest';

import { integration } from '../pure.specification.js';

/**
 * The table form chapter 06 prescribes for the golden half: one row per case,
 * the golden named by the row. The names are written as a template literal,
 * which is the shape a hand-paired fixture wall collapses into — and the shape
 * the checker's C9 pass has to read as a reference rather than as silence.
 */
const CASES = [
    { name: 'empty', of: [] as number[] },
    { name: 'one', of: [7] },
    { name: 'many', of: [7, 11, 13] },
];

describe('integration — a table of cases, one golden each', () => {
    test.each(CASES)('totals $name', async ({ name, of }) => {
        // Given - the module summing what the row carries
        const result = await integration.call(() => ({
            count: of.length,
            total: of.reduce((sum, each) => sum + each, 0),
        }));

        // Then - the golden the row names is the oracle
        expect(result.value).toMatch(`${name}.json`);
        await expect(result.error).toBeEmpty();
    });

    test('a one-field reading needs no golden at all', async () => {
        // Given - a call whose return type the chain already knows
        const result = await integration.call(() => ({ ok: true, seen: 3 }));

        // Then - `.call<T>()` carries T through, so the field is read inline rather than frozen into a file for the sake of one boolean
        expect(result.value.value.ok).toBe(true);
        expect(result.value.value.seen).toBe(3);
    });
});
