import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { api } from '../api.specification.js';

describe('templates', () => {
    test('a user is read back by its id', async () => {
        // Given - one user, numbered 1 by the reset
        const result = await api
            .seed(file('../_seeds/alice.sql'), {
                database: 'db',
            })
            .get('/users/:id', { params: { id: 1 } });

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

    // RUNTIME route-written-as-template-at-runtime — a route template is handed exactly its parameters, and a value no parameter takes is refused before a request is sent.
    test('a template handed a parameter it does not name is refused', async () => {
        // Given - the item route, handed past the compiler a value under another name
        const sent = api.get('/users/:id', { params: { userId: 1 } } as never);

        // Then - refused, naming both halves of the mismatch
        await expect(sent).rejects.toThrow(
            'found: .get("/users/:id", { params }): :id has no value, `userId` is no parameter of it',
        );
    });

    test('a template handed no values is refused, naming the parameter it holds, before the chain seeds anything', async () => {
        // Given - a chain whose seed fails if it runs, sending a template without its params past the types
        const send = api.seed(file('./_seeds/unknown-table.sql'), { database: 'db' }).get as (
            path: string,
        ) => Promise<unknown>;

        // Then - the template is refused, rather than sent with `:id` as a literal segment, and before the seed could fail
        await expect(send('/users/:id')).rejects.toThrow(
            [
                'found: .get("/users/:id") names :id and is handed no params',
                'why: A request written as its route template is handed exactly the parameters the template names.',
                'fix: write .get("/users/:id", { params: { id: … } })',
                'read: docs/19-linting.md#route-written-as-template-at-runtime',
            ].join('\n'),
        );
    });
});
