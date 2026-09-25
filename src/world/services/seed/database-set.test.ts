import { describe, expect, test } from 'vitest';

import type { DatabasePort } from '../database.port.js';
import { databaseSet } from './database-set.js';

/** A database no seed of these tests reaches. */
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

describe('databaseSet — the database a seed names', () => {
    test('a key the record does not declare is refused, the declared keys listed', () => {
        // Given - two named databases
        const databases = databaseSet({
            databases: new Map([
                ['analytics', idle()],
                ['db', idle()],
            ]),
        });

        // Then - the refusal names the missing key and enumerates the record
        expect(() => databases.target('ghost')).toThrow(
            'seed() targets database "ghost" but it was not found. Available: analytics, db',
        );
    });

    test('a seed on a runner that declares no database is refused', () => {
        // Given - a runner with no database at all, and a seed that names none
        const databases = databaseSet({});
        const options: { database?: string } = {};

        // Then - the seed has nowhere to run, and says so
        expect(() => databases.target(options.database)).toThrow(
            'seed() requires a database adapter',
        );
    });
});
