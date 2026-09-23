import { Hono } from 'hono';
import { describe, expect, test } from 'vitest';

import { file, specification, sql } from '../../../src/index.js';
import type { ApiSpecification } from '../../../src/index.js';
import { api } from '../api.specification.js';

describe('seeding', () => {
    test('seeds apply in the order listed, each to the database it names', async () => {
        // Given - a shared user, a user written in the test after it, and an event in the other database
        const result = await api
            .seed(file('../../seeds/one-user.sql'), { database: 'db' })
            .seed(sql`INSERT INTO "users" (name, email) VALUES ('Charlie', 'charlie@test.com');`, {
                database: 'db',
            })
            .seed(file('../../seeds/one-event.sql'), { database: 'analyticsDb' })
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

    test('each database is seeded on its own, and each holds only its rows', async () => {
        // Given - two users in one database, two events in the other
        const result = await api
            .seed(file('../../seeds/two-users.sql'), { database: 'db' })
            .seed(file('../../seeds/two-events.sql'), { database: 'analyticsDb' })
            .get('/events');

        // Then - the events the app reads, and the users table untouched by them
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {
                "events": [
                    {
                        "type": "user_created",
                        "payload": "{\\"name\\":\\"Alice\\"}"
                    },
                    {
                        "type": "user_created",
                        "payload": "{\\"name\\":\\"Bob\\"}"
                    }
                ]
            }
        `);
        await expect(result.table('users', { database: 'db' })).toMatch([
            [1, 'Alice', 'alice@test.com'],
            [2, 'Bob', 'bob@test.com'],
        ]);
    });

    test('lays the statements written in the test over a shared seed', async () => {
        // Given - the shared pool's two users, and a third written in the test
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
});

describe('seeding details', () => {
    // RUNTIME A7 — with two databases `database:` is required on every seed,
    // And with one it is refused: the record fixes the call.
    test('requires the database option when several databases are declared', () => {
        // Given - a spec with two postgres handles (db + analytics)
        // Then - .seed() without a database option violates A7, synchronously checker-disable-next-line a7 -- negative spec: the omitted database is the behaviour under test (runtime channel)
        expect(() => api.seed(file('../../seeds/one-user.sql'))).toThrow(
            'found: seed() names no database, and 2 databases are declared ("analyticsDb", "db")',
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
