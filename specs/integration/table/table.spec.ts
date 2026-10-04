import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { tally } from '../_fixtures/orders/tally.js';
import { integration as withDatabase } from '../integration.specification.js';
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

    test('with one database, a table read that names it is refused as redundant', async () => {
        // Given - a call against the integration runner, whose specification declares one database
        const result = await withDatabase.call(() => 'called');

        // Then - naming the lone database is refused before any query
        expect(() => result.table('orders', { database: 'db' })).toThrow(
            [
                'found: table() names a database, and "db" is the only one declared',
                'why: With two SQL databases or more, a seed or a table names the `database:` it reads, and with exactly one it names none.',
                "fix: delete { database: 'db' }",
                'read: docs/reference/linting.md#database-named-only-when-several-at-runtime',
            ].join('\n'),
        );
    });
});
