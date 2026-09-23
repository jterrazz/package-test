import { describe, expect, test } from 'vitest';

import { directory, file, sql } from '../../../src/index.js';
import { api } from '../api.specification.js';

describe('requests', () => {
    test('a complete request is sent whole, and the user it creates lands in both databases', async () => {
        // Given - the complete request, written in the test
        const result = await api.request(`
            POST /users
            content-type: application/json

            {
                "name": "Charlie",
                "email": "charlie@test.com"
            }
        `);

        // Then - the created user, in the users table and as an event
        expect(result.response).toMatch(`
            HTTP/1.1 201 Created
            content-type: application/json

            {
                "user": {
                    "name": "Charlie",
                    "email": "charlie@test.com"
                }
            }
        `);
        await expect(result.table('users', { database: 'db' })).toMatch([
            [1, 'Charlie', 'charlie@test.com'],
        ]);
        await expect(result.table('events', { database: 'analyticsDb' })).toMatch([
            [1, 'user_created', '{"name":"Charlie","email":"charlie@test.com"}', '{{iso8601}}'],
        ]);
    });

    test('an inline body is sent as the value written in the test', async () => {
        // Given - a user posted with its fields written in place
        const result = await api.post('/users', { email: 'dora@test.com', name: 'Dora' });

        // Then - the user created, and the row it wrote
        expect(result.response).toMatch(`
            HTTP/1.1 201 Created
            content-type: application/json

            {
                "user": {
                    "name": "Dora",
                    "email": "dora@test.com"
                }
            }
        `);
        await expect(result.table('users', { database: 'db' })).toMatch([
            [1, 'Dora', 'dora@test.com'],
        ]);
    });

    test('a JSON body file is sent as its value, not as the layout of the file', async () => {
        // Given - a body named by its path
        // checker-disable-next-line c28 -- the file form is the subject: a JSON body read from its file
        const result = await api.post('/echo-raw', file('./requests/erin.json'));

        // Then - the app received the compact JSON of the value
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {
                "raw": "{\\"email\\":\\"erin@test.com\\",\\"name\\":\\"Erin\\"}"
            }
        `);
    });

    test('a body file that is not JSON is sent as its bytes are written', async () => {
        // Given - a plain-text body named by its path
        // checker-disable-next-line c28 -- the file form is the subject: a text body read from its file
        const result = await api.post('/echo-raw', file('./requests/note.txt'));

        // Then - the app received the text verbatim, whitespace kept
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {
                "raw": "kept  as\\n    written\\n"
            }
        `);
    });

    test('a request file whose body is plain text sends it verbatim, whitespace kept', async () => {
        // Given - a request file carrying a text body
        // checker-disable-next-line c28 -- the file form is the subject: a complete request read from its .http file
        const result = await api.request(file('./requests/echo-raw.http'));

        // Then - the body arrived as written
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {
                "raw": "first  line\\n    indented line"
            }
        `);
    });

    test('the users seeded are the users listed, in the order they were inserted', async () => {
        // Given - the two users the specs root shares
        const result = await api
            .seed(file('../../seeds/two-users.sql'), { database: 'db' })
            .get('/users');

        // Then - both, in order
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
                    }
                ]
            }
        `);
    });

    test('a user is read back by its id', async () => {
        // Given - one user, numbered 1 by the reset
        const result = await api
            .seed(sql`INSERT INTO "users" (name, email) VALUES ('Alice', 'alice@test.com');`, {
                database: 'db',
            })
            .get('/users/1');

        // Then - that user
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {
                "user": {
                    "name": "Alice",
                    "email": "alice@test.com"
                }
            }
        `);
    });

    test('a put renames the user, its fields written in the test', async () => {
        // Given - one user, and the fields it is renamed to
        const result = await api
            .seed(sql`INSERT INTO "users" (name, email) VALUES ('Alice', 'alice@test.com');`, {
                database: 'db',
            })
            .put('/users/1', { email: 'updated@test.com', name: 'Alice Updated' });

        // Then - the renamed user, answered and stored
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {
                "user": {
                    "name": "Alice Updated",
                    "email": "updated@test.com"
                }
            }
        `);
        await expect(result.table('users', { database: 'db' })).toMatch([
            [1, 'Alice Updated', 'updated@test.com'],
        ]);
    });

    test('deleting a user that does not exist answers not found', async () => {
        // Given - an empty users table
        const result = await api.delete('/users/999');

        // Then - the refusal, whole
        expect(result.response).toMatch(`
            HTTP/1.1 404 Not Found
            content-type: application/json

            {
                "error": "User not found"
            }
        `);
    });

    test('the chain headers win over the request file headers, and repeated calls merge', async () => {
        // Given - the file sets x-file and x-chain; the chain overrides x-chain twice
        const result = await api.headers({ 'x-chain': 'first' }).headers({ 'x-chain': 'second' })
            .request(`
                POST /echo
                content-type: application/json
                x-file: from-file
                x-chain: from-file

                {
                    "greeting": "hello"
                }
            `);

        // Then - the file header kept, the last chain header won, the body forwarded
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {
                "body": {
                    "greeting": "hello"
                },
                "headers": {
                    "x-chain": "second",
                    "x-file": "from-file"
                }
            }
        `);
    });
});

// ── Edge cases ──

describe('request errors', () => {
    test('refuses a directory as a body, naming the one-file form', async () => {
        // Given - a body named by directory()
        // Then - the chain rejects before a request is sent: a body is one file
        await expect(api.post('/users', directory('./requests/'))).rejects.toThrow(
            '.post("/users", directory("./requests/")): a body is one file — name it with file().',
        );
    });

    test('throws on nonexistent request file', async () => {
        // Given - reference to a nonexistent .http file
        // Then - the chain rejects with ENOENT
        // checker-disable-next-line c8 -- negative spec: the missing file IS the behaviour under test
        await expect(api.request(file('./requests/nonexistent.http'))).rejects.toThrow('ENOENT');
    });
});
