import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import type { DatabasePort } from '../database.port.js';
import { databaseSet } from './database-set.adapter.js';

/** A database that logs its resets under its name. */
function database(log: string[], name: string): DatabasePort {
    return {
        columns: async () => await Promise.resolve([]),
        query: async () => await Promise.resolve([]),
        reset: async () => {
            log.push(`reset ${name}`);
            await Promise.resolve();
        },
        seed: async () => {
            await Promise.resolve();
        },
    };
}

function refusalOf(work: () => unknown): string {
    try {
        work();
        return '';
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
}

describe('databaseSet', () => {
    test('database-set — reads a seed file from the spec’s folder, and refuses a path not relative to it', () => {
        // Given - a spec folder holding a seed
        const testDir = mkdtempSync(join(tmpdir(), 'seed-'));
        mkdirSync(join(testDir, '_seeds'));
        writeFileSync(join(testDir, '_seeds/users.sql'), 'INSERT INTO users VALUES (1);');

        // Then - the seed's text, and the refusal of an absolute path
        const set = databaseSet({});
        expect([
            set.read('./_seeds/users.sql', testDir),
            refusalOf(() => set.read('/seeds/users.sql', testDir)),
        ]).toStrictEqual([
            'INSERT INTO users VALUES (1);',
            [
                'found: seed("/seeds/users.sql"), a path that is not relative to the spec file',
                'why: A verb that reads the disk takes a `file()` or a `directory()`, whose path starts with `./` or `../` and ends in `/` exactly when it names a directory.',
                "fix: start it with ./ or ../, from the spec file: seed('./seeds/users.sql')",
                'read: docs/24-linting.md#disk-named-by-relative-path-at-runtime',
            ].join('\n'),
        ]);
    });

    test('database-set — resets every declared database, the only one when there is one, and none when there is none', async () => {
        // Given - a set of two databases, a set of one, and an empty set
        const log: string[] = [];
        const several = databaseSet({
            database: database(log, 'unused'),
            databases: new Map([
                ['orders', database(log, 'orders')],
                ['users', database(log, 'users')],
            ]),
        });
        const one = databaseSet({ database: database(log, 'only') });

        // When - each resets
        await several.reset();
        await one.reset();
        await databaseSet({}).reset();

        // Then - each database of the set, then the only one
        expect(log).toStrictEqual(['reset orders', 'reset users', 'reset only']);
    });

    test('database-set — targets the database a seed names, and the only one when it names none or an empty name', () => {
        // Given - a set of two databases beside the one the chain knows first
        const log: string[] = [];
        const [first, orders] = [database(log, 'first'), database(log, 'orders')];
        const set = databaseSet({
            database: first,
            databases: new Map([['orders', orders]]),
        });

        // Then - the named one, else the first
        expect([set.target('orders'), set.target(), set.target('')]).toStrictEqual([
            orders,
            first,
            first,
        ]);
    });

    test('database-set — refuses a name no database is declared under, and a seed with no database', () => {
        // Given - a set of two databases, and an empty set
        const log: string[] = [];
        const set = databaseSet({
            database: database(log, 'orders'),
            databases: new Map([
                ['orders', database(log, 'orders')],
                ['users', database(log, 'users')],
            ]),
        });

        // Then - each refusal whole
        expect([
            refusalOf(() => set.target('billing')),
            refusalOf(() => databaseSet({}).target('orders')),
        ]).toStrictEqual([
            [
                'found: seed() targets the database "billing", and none is declared under that key',
                'why: `database:` names a key of the services record.',
                'fix: name a declared database: orders, users',
                'read: docs/18-services.md#the-database-rule',
            ].join('\n'),
            [
                'found: seed(), and no database is declared',
                'why: A seed writes into a declared database.',
                'fix: declare a database in the specification’s `services` — `postgres()` or `sqlite()` — or drop the seed',
                'read: docs/18-services.md#the-database-rule',
            ].join('\n'),
        ]);
    });
});
