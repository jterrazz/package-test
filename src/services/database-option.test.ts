import { describe, expect, test } from 'vitest';

import { validateDatabaseOption } from './database-option.js';

function refusalOf(work: () => void): string {
    try {
        work();
        return '';
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
}

const WHY =
    'why: With two SQL databases or more, a seed or a table names the `database:` it reads, and with exactly one it names none.';

describe('validateDatabaseOption', () => {
    test('database-option — a database is named only when several are declared — accepted when it is, and when none is declared', () => {
        // Given - each case the rule allows
        // Then - none refused
        expect([
            refusalOf(() => {
                validateDatabaseOption('seed', {}, 'orders');
            }),
            refusalOf(() => {
                validateDatabaseOption('seed', { databaseKeys: ['orders', 'users'] }, 'users');
            }),
            refusalOf(() => {
                validateDatabaseOption('table', { databaseKeys: ['orders'] });
            }),
        ]).toStrictEqual(['', '', '']);
    });

    test('database-option — a database is named only when several are declared — refused when several go unnamed, or the only one is named', () => {
        // Given - two databases and a call naming none, and one database and a call naming it
        // Then - each refusal whole
        expect([
            refusalOf(() => {
                validateDatabaseOption('table', { databaseKeys: ['orders', 'users'] });
            }).split('\n'),
            refusalOf(() => {
                validateDatabaseOption('seed', { databaseKeys: ['orders'] }, 'orders');
            }).split('\n'),
        ]).toStrictEqual([
            [
                'found: table() names no database, and 2 databases are declared ("orders", "users")',
                WHY,
                "fix: pass the database it reads: { database: 'orders' }, or another declared key",
                'read: docs/24-linting.md#database-named-only-when-several-at-runtime',
            ],
            [
                'found: seed() names a database, and "orders" is the only one declared',
                WHY,
                "fix: delete { database: 'orders' }",
                'read: docs/24-linting.md#database-named-only-when-several-at-runtime',
            ],
        ]);
    });
});
