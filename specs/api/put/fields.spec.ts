import { describe, expect, test } from 'vitest';

import { file } from '../../../src/index.js';
import { api } from '../api.specification.js';

describe('fields', () => {
    test('a put renames the user, its fields written in the test', async () => {
        // Given - one user, and the fields it is renamed to
        const result = await api
            .seed(file('../../_shared/_seeds/alice.sql'), {
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
});
