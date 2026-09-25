import { describe, expect, test } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { api } from '../api.specification.js';

describe('sending', () => {
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

    test('refuses a directory as a body, naming the one-file form', async () => {
        // Given - a body named by directory()
        // Then - the chain rejects before a request is sent: a body is one file
        // checker-disable-next-line c8 -- negative spec: the refusal fires before the disk is read
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
