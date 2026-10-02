import { file, specification } from '@jterrazz/test';
import type { ApiSpecification } from '@jterrazz/test';
import { Hono } from 'hono';
import { describe, expect, test } from 'vitest';

import { api } from '../api.specification.js';

describe('files', () => {
    test('seeds apply in the order listed, each to the database it names', async () => {
        // Given - a user, a second seeded after it, and an event in the other database
        const result = await api
            .seed(file('../_seeds/one-user.sql'), { database: 'db' })
            .seed(file('./_seeds/charlie.sql'), {
                database: 'db',
            })
            .seed(file('./_seeds/one-event.sql'), { database: 'analyticsDb' })
            .get('/users');

        // Then - the users in the order the seeds ran, and the event where it was laid
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {
                "users": [
                    {
                        "name": "Alice",
                        "email": "alice@test.com"
                    },
                    {
                        "name": "Charlie",
                        "email": "charlie@test.com"
                    }
                ]
            }
        `);
        await expect(result.table('events', { database: 'analyticsDb' })).toMatch([
            [1, 'user_created', '{"name":"Alice"}', '{{iso8601}}'],
        ]);
    });

    test('lays a leaf seed over a shared one', async () => {
        // Given - the shared pool's two users, and a third from the leaf's own seed
        const result = await api
            .seed(file('../../_shared/_seeds/two-users.sql'), { database: 'db' })
            .seed(file('./_seeds/carol.sql'), { database: 'db' })
            .get('/users');

        // Then - the three rows, in the order the seeds ran
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {
                "users": [
                    {
                        "name": "Alice",
                        "email": "alice@test.com"
                    },
                    {
                        "name": "Bob",
                        "email": "bob@test.com"
                    },
                    {
                        "name": "Carol",
                        "email": "carol@test.com"
                    }
                ]
            }
        `);
        await expect(result.table('users', { database: 'db' })).toMatch([
            [1, 'Alice', 'alice@test.com'],
            [2, 'Bob', 'bob@test.com'],
            [3, 'Carol', 'carol@test.com'],
        ]);
    });

    // RUNTIME database-named-only-when-several-at-runtime — with two databases `database:` is required on every seed, and with one it is refused: the record fixes the call.
    test('requires the database option when several databases are declared', () => {
        // Given - a spec with two postgres handles (db + analytics)
        // Then - .seed() without a database option violates `database-named-only-when-several-at-runtime`, synchronously checker-disable-next-line database-named-only-when-several -- negative spec: the omitted database is the behaviour under test (runtime channel)
        expect(() => api.seed(file('../_seeds/one-user.sql'))).toThrow(
            'found: seed() names no database, and 2 databases are declared ("analyticsDb", "db")',
        );
    });

    test('throws on nonexistent seed file', async () => {
        // Given - reference to nonexistent seed
        // Then - the chain rejects with ENOENT
        await expect(
            // checker-disable-next-line named-path-exists -- negative spec: the missing file IS the behaviour under test
            api.seed(file('./_seeds/nonexistent.sql'), { database: 'db' }).get('/users'),
        ).rejects.toThrow('ENOENT');
    });

    test('throws on unknown database key', async () => {
        // Given - reference to nonexistent database service (bypass the typed keys on purpose)
        const untypedApi = api as ApiSpecification;

        // Then - the chain rejects naming the unknown key
        await expect(
            untypedApi
                .seed(file('../_seeds/one-user.sql'), { database: 'nonexistent-db' })
                .get('/users'),
        ).rejects.toThrow(
            'found: seed() targets the database "nonexistent-db", and none is declared under that key',
        );
    });

    test.runIf(process.env.TEST_MODE !== 'compose')(
        'seed() without any declared SQL database fails with a clear error',
        async () => {
            // Given - an api runner whose services record declares no database
            // oxlint-disable-next-line jterrazz/runner-in-specification-file, jterrazz/no-runner-alias -- negative-path runner: it exists only to fail .seed(), and aliasing avoids shadowing the module-level `api`
            const { api: bareApi, cleanup: stop } = await specification.api({
                server: () => new Hono(),
            });

            try {
                // Then - the chain fails because nothing can execute the SQL
                await expect(bareApi.seed(file('../_seeds/one-user.sql')).get('/')).rejects.toThrow(
                    'found: seed(), and no database is declared',
                );
            } finally {
                await stop();
            }
        },
    );
});
