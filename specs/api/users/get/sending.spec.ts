import { describe, expect, test } from 'vitest';

import { file } from '../../../../src/index.js';
import { api } from '../../api.specification.js';

describe('sending', () => {
    test('a user is read back by its id', async () => {
        // Given - one user, numbered 1 by the reset
        const result = await api
            .seed(file('../../../seeds/alice.sql'), {
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
});
