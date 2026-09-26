import { describe, expect, test } from 'vitest';

import { file } from '../../../src/index.js';
import { tally } from '../_fixtures/orders/tally.js';
import { integration } from '../pure.specification.js';

/** Golden names in a template literal: the shape `no-unused-ground` must read as a reference rather than silence. */
const CASES = [
    { name: 'empty', of: [] as number[] },
    { name: 'one', of: [7] },
    { name: 'many', of: [7, 11, 13] },
];

describe('table', () => {
    test.each(CASES)('totals $name', async ({ name, of }) => {
        // Given - the module summing what the row carries
        const result = await integration.call(() => tally(of));

        // Then - the golden the row names is the oracle
        expect(result.value).toMatch(file(`./_expected/${name}.json`));
        expect(result.error.text).toBe('');
    });

    test('a one-field reading needs no golden at all', async () => {
        // Given - a call whose return type the chain already knows
        const result = await integration.call(() => ({ ok: true, seen: 3 }));

        // Then - `.call<T>()` carries T through, so the field is read inline rather than frozen into a file for the sake of one boolean
        expect(result.value.value.ok).toBe(true);
        expect(result.value.value.seen).toBe(3);
    });
});
