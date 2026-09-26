import { describe, expect, test } from 'vitest';

import { BaseResult } from './result.js';
import type { TableSource } from './table/table.js';

function holding(rows: unknown[][]): TableSource {
    return {
        columns: async (table) => await Promise.resolve(table === 'users' ? ['id', 'name'] : []),
        query: async () => await Promise.resolve(rows),
    };
}

describe('BaseResult', () => {
    test('table() — the lone declared database — reads the named table from it, whole', async () => {
        // Given - a result over one database, declared as "db"
        const result = new BaseResult({
            config: { database: holding([[1, 'Ada']]), databaseKeys: ['db'] },
            testDir: '/specs/users',
        });

        // When - the test reads a table with no database option
        const table = result.table('users');

        // Then - the accessor names the table and reads its columns and rows from that database
        expect(table.name).toBe('users');
        await expect(table.content()).resolves.toStrictEqual({
            columns: ['id', 'name'],
            rows: [[1, 'Ada']],
        });
    });

    test('table() — two declared databases — reads from the one the option names', async () => {
        // Given - a result over two databases, each holding its own rows
        const result = new BaseResult({
            config: {
                databaseKeys: ['analytics', 'db'],
                databases: new Map([
                    ['analytics', holding([[2, 'Grace']])],
                    ['db', holding([[1, 'Ada']])],
                ]),
            },
            testDir: '/specs/users',
        });

        // When - the test names the database it reads
        const table = result.table('users', { database: 'analytics' });

        // Then - the rows are that database's
        await expect(table.content()).resolves.toStrictEqual({
            columns: ['id', 'name'],
            rows: [[2, 'Grace']],
        });
    });

    test('table() — the database option rule (rule `database-named-only-when-several-at-runtime`) — with a single database, the option is refused as redundant', () => {
        // Given - a result over one database, declared as "db"
        const result = new BaseResult({
            config: { database: holding([]), databaseKeys: ['db'] },
            testDir: '/specs/users',
        });

        // Then - naming it is refused, synchronously
        expect(() => result.table('users', { database: 'db' })).toThrow(
            'found: table() names a database, and "db" is the only one declared',
        );
    });
});
