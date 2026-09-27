import { describe, expect, test } from 'vitest';

import type { DatabasePort } from '../database.port.js';
import { databaseSet } from './database-set.adapter.js';

function idle(): DatabasePort {
    return {
        columns: async () => await Promise.resolve([]),
        query: async () => await Promise.resolve([]),
        reset: async () => {
            await Promise.resolve();
        },
        seed: async () => {
            await Promise.resolve();
        },
    };
}

describe('databaseSet', () => {
    test('databaseSet — the database a seed names — a key the record does not declare is refused, the declared keys listed', () => {
        // Given - two named databases
        const databases = databaseSet({
            databases: new Map([
                ['analytics', idle()],
                ['db', idle()],
            ]),
        });

        // Then - the refusal names the missing key and enumerates the record
        expect(() => databases.target('ghost')).toThrow(
            [
                'found: seed() targets the database "ghost", and none is declared under that key',
                'why: `database:` names a key of the services record.',
                'fix: name a declared database: analytics, db',
                'read: docs/17-services.md#the-database-rule',
            ].join('\n'),
        );
    });

    test('databaseSet — the database a seed names — a seed on a runner that declares no database is refused', () => {
        // Given - a runner with no database at all, and a seed that names none
        const databases = databaseSet({});
        const options: { database?: string } = {};

        // Then - the seed has nowhere to run, and says so
        expect(() => databases.target(options.database)).toThrow(
            [
                'found: seed(), and no database is declared',
                'why: A seed writes into a declared database.',
                'fix: declare a database in the specification’s `services` — `postgres()` or `sqlite()` — or drop the seed',
                'read: docs/17-services.md#the-database-rule',
            ].join('\n'),
        );
    });
});
