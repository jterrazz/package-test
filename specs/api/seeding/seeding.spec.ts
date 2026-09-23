import { Hono } from 'hono';
import { describe, expect, test } from 'vitest';

import { file, specification, sql } from '../../../src/index.js';
import type { ApiSpecification } from '../../../src/index.js';
import { api } from '../api.specification.js';

// What a seed loads, in order and per database, is data: the documents beside
// This file state it. What stays here is what a chain REFUSES (A7, a missing
// File, an unknown database) and a runner with no database at all.

describe('seeding', () => {
    test('lays the statements written in the test, in the database it names', async () => {
        // Given - a user written in the test, and the shared pool's two under it
        const result = await api
            .seed(file('../../seeds/two-users.sql'), { database: 'db' })
            .seed(
                sql`
                    INSERT INTO "users" (name, email) VALUES ('Carol', 'carol@test.com');
                `,
                { database: 'db' },
            )
            .get('/users');

        // Then - the three rows, in the order the seeds ran
        await expect(result.table('users', { database: 'db' })).toMatch([
            [1, 'Alice', 'alice@test.com'],
            [2, 'Bob', 'bob@test.com'],
            [3, 'Carol', 'carol@test.com'],
        ]);
    });
});

describe('seeding details', () => {
    // RUNTIME A7 — with two databases `database:` is required on every seed,
    // And with one it is refused: the record fixes the call.
    test('requires the database option when several databases are declared', () => {
        // Given - a spec with two postgres handles (db + analytics)
        // Then - .seed() without a database option violates A7, synchronously checker-disable-next-line a7 -- negative spec: the omitted database is the behaviour under test (runtime channel)
        expect(() => api.seed(file('../../seeds/one-user.sql'))).toThrow(
            'seed(): 2 databases are declared ("analyticsDb", "db") — pass { database: <key> } to target one of them.',
        );
    });

    test('throws on nonexistent seed file', async () => {
        // Given - reference to nonexistent seed
        // Then - the chain rejects with ENOENT
        await expect(
            // checker-disable-next-line c8 -- negative spec: the missing file IS the behaviour under test
            api.seed(file('./seeds/nonexistent.sql'), { database: 'db' }).get('/users'),
        ).rejects.toThrow('ENOENT');
    });

    test('throws on unknown database key', async () => {
        // Given - reference to nonexistent database service (bypass the typed keys on purpose)
        const untypedApi = api as ApiSpecification;

        // Then - the chain rejects naming the unknown key
        await expect(
            untypedApi
                .seed(file('../../seeds/one-user.sql'), { database: 'nonexistent-db' })
                .get('/users'),
        ).rejects.toThrow('seed() targets database "nonexistent-db" but it was not found');
    });

    // Node-only: in compose mode the databases are auto-detected from the
    // Compose file, so a "zero databases" runner cannot exist there.
    test.runIf(process.env.TEST_MODE !== 'compose')(
        'seed() without any declared SQL database fails with a clear error',
        async () => {
            // Given - an api runner whose services record declares no database
            // oxlint-disable-next-line jterrazz/a1-specification-file, jterrazz/a3-no-destructure-alias -- negative-path runner: it exists only to fail .seed(), and aliasing avoids shadowing the module-level `api`
            const { api: bareApi, cleanup: stop } = await specification.api({
                server: () => new Hono(),
            });

            try {
                // Then - the chain fails because nothing can execute the SQL
                await expect(
                    bareApi.seed(file('../../seeds/one-user.sql')).get('/'),
                ).rejects.toThrow('seed() requires a database adapter');
            } finally {
                await stop();
            }
        },
    );
});
