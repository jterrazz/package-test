import { describe, expect, test } from 'vitest';

import { file } from '../../../../src/index.js';
import { api } from '../../api.specification.js';

describe('sending', () => {
    test('the users seeded are the users listed, in the order they were inserted', async () => {
        // Given - the two users the specs root shares
        const result = await api
            .seed(file('../../../seeds/two-users.sql'), { database: 'db' })
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
});
