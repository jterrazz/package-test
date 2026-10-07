import { file, text } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { api } from '../api.specification.js';

/** Awaited, so it serves the sync matchers and the SQL-backed table ones alike. */
async function catchMessage(assertion: () => unknown): Promise<string> {
    try {
        await assertion();
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
    throw new Error('expected the assertion to throw, but it passed');
}

describe('results', () => {
    test('response matches expected file', async () => {
        // Given - seeded data
        const result = await api
            .seed(file('../../__seeds__/two-users.sql'), { database: 'db' })
            .get('/users');

        // Then - status + body match __expected__/all-users.http
        // checker-disable-next-line ground-shared-or-inline -- the file form is the subject: a response compared to its .http golden on disk
        expect(result.response).toMatch(file('./__expected__/all-users.http'));
    });

    /* invariant: the framework's own mismatch diff is the product under test, so it is goldened in full. */

    test('toMatch shows diff on body mismatch', async () => {
        // Given - response differs from expected file
        const result = await api
            .seed(file('../../__seeds__/two-users.sql'), { database: 'db' })
            .get('/users');

        // Then - error names the fixture and shows the full -/+ diff of both values frozen - wrong-body.http is deliberately wrong (its diff IS the subject). The error golden below legitimately updates, but the wrong fixture must never be rewritten
        const message = await catchMessage(() => {
            expect(result.response).toMatch(
                `
                HTTP/1.1 200 OK

                {
                    "users": [
                        {
                            "name": "Wrong1",
                            "email": "wrong1@test.com"
                        },
                        {
                            "name": "Wrong2",
                            "email": "wrong2@test.com"
                        }
                    ]
                }
            `,
                { frozen: true },
            );
        });
        expect(text(message)).toMatch(`
            Response mismatch (the value in place)

            - Expected
            + Received

              {
                "users": [
                  {
            -       "name": "Wrong1",
            +       "name": "Alice",
            -       "email": "wrong1@test.com"
            +       "email": "alice@test.com"
                  },
                  {
            -       "name": "Wrong2",
            +       "name": "Bob",
            -       "email": "wrong2@test.com"
            +       "email": "bob@test.com"
                  }
                ]
              }`);
    });

    test('toMatch fails on nonexistent fixture with an update hint', async () => {
        // Given - valid request
        const result = await api.get('/users');

        // Then - clear error pointing at TEST_UPDATE frozen - the missing fixture is the behaviour under test; under TEST_UPDATE it must still throw "does not exist" rather than be spuriously created
        expect(() => {
            // checker-disable-next-line named-path-exists -- negative spec: the missing fixture IS the behaviour under test
            expect(result.response).toMatch(file('./__expected__/nonexistent.http'), {
                frozen: true,
            });
        }).toThrow(/does not exist[\s\S]*TEST_UPDATE=1/u);
    });

    test('a table is compared whole to its rows written in place — every column, in its order', async () => {
        // Given - one user seeded
        const result = await api
            .seed(file('../__seeds__/one-user.sql'), { database: 'db' })
            .get('/users');

        // Then - the whole table, its generated id through a token
        await expect(result.table('users', { database: 'db' })).toMatch([
            [1, 'Alice', 'alice@test.com'],
        ]);
    });

    test('table details — shows diff on multi-column mismatch', async () => {
        // Given - two users in table, expecting wrong values
        const result = await api
            .seed(file('../../__seeds__/two-users.sql'), { database: 'db' })
            .get('/users');

        // Then - error shows both columns in the full -/+ diff
        const message = await catchMessage(async () => {
            await expect(result.table('users', { database: 'db' })).toMatch(
                [
                    [1, 'Wrong1', 'wrong1@test.com'],
                    [2, 'Wrong2', 'wrong2@test.com'],
                ],
                { frozen: true },
            );
        });
        expect(text(message)).toMatch(`
            Table "users" mismatch
              query: id, name, email
              expected: 2 rows
              received: 2 rows

            - Expected
            + Received

              id  |  name  |  email
            - 1  |  Wrong1  |  wrong1@test.com
            + 1  |  Alice  |  alice@test.com
            - 2  |  Wrong2  |  wrong2@test.com
            + 2  |  Bob  |  bob@test.com`);
    });

    test('table details — shows diff on extra rows', async () => {
        // Given - table has more rows than expected
        const result = await api
            .seed(file('../../__seeds__/two-users.sql'), { database: 'db' })
            .get('/users');

        // Then - row count mismatch + extra rows with + marker (full diff)
        const message = await catchMessage(async () => {
            await expect(result.table('users', { database: 'db' })).toMatch(
                [[1, 'Alice', 'alice@test.com']],
                { frozen: true },
            );
        });
        expect(text(message)).toMatch(`
            Table "users" mismatch
              query: id, name, email
              expected: 1 row
              received: 2 rows

            - Expected
            + Received

              id  |  name  |  email
              1  |  Alice  |  alice@test.com
            + 2  |  Bob  |  bob@test.com`);
    });

    test('table details — shows diff on missing rows', async () => {
        // Given - empty table, expecting rows
        const result = await api.get('/users');

        // Then - row count mismatch + missing rows with - marker (full diff)
        const message = await catchMessage(async () => {
            await expect(result.table('users', { database: 'db' })).toMatch(
                [[1, 'Alice', 'alice@test.com']],
                { frozen: true },
            );
        });
        expect(text(message)).toMatch(`
            Table "users" mismatch
              query: id, name, email
              expected: 1 row
              received: 0 rows

            - Expected
            + Received

              id  |  name  |  email
            - 1  |  Alice  |  alice@test.com`);
    });

    test('table details — supports toBeEmpty', async () => {
        // Given - nothing seeded
        const result = await api.get('/users');

        // Then - the table is empty
        await expect(result.table('users', { database: 'db' })).toBeEmpty();
    });

    test('table details — toBeEmpty fails on a table holding a row, naming the count', async () => {
        // Given - one user seeded
        const result = await api
            .seed(file('../__seeds__/one-user.sql'), { database: 'db' })
            .get('/users');

        // Then - the matcher refuses, and says how many rows it found
        await expect(expect(result.table('users', { database: 'db' })).toBeEmpty()).rejects.toThrow(
            /^Expected table "users" to be empty, but it has 1 row$/u,
        );
    });

    test('table details — throws on unknown database key', async () => {
        // Given - valid request
        const result = await api.get('/users');

        // Then - table() with nonexistent service fails clearly
        expect(() => result.table('users', { database: 'nonexistent-db' })).toThrow(
            'found: table("users") reads the database "nonexistent-db", and none is declared under that key',
        );
    });

    test('table details — requires the database option when several databases are declared', async () => {
        // Given - a spec with two postgres handles (db + analytics)
        const result = await api.get('/users');

        // Then - table() without a database option violates `database-named-only-when-several-at-runtime` checker-disable-next-line database-named-only-when-several -- negative spec: the omitted database is the behaviour under test (runtime channel)
        expect(() => result.table('users')).toThrow(
            'found: table() names no database, and 2 databases are declared ("analyticsDb", "db")',
        );
    });
});
