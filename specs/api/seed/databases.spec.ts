import { describe, expect, test } from 'vitest';

import { file } from '../../../src/index.js';
import { api } from '../api.specification.js';

describe('databases', () => {
    test('each database is seeded on its own, and each holds only its rows', async () => {
        // Given - two users in one database, two events in the other
        const result = await api
            .seed(file('../../_shared/_seeds/two-users.sql'), { database: 'db' })
            .seed(file('../_seeds/two-events.sql'), { database: 'analyticsDb' })
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
});
