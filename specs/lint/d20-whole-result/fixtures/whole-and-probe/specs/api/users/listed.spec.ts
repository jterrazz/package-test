import { describe, expect, test } from 'vitest';

import { api } from '../api.specification.js';

describe('listed', () => {
test('lists the users', async () => {
    // Given - an empty table
    const result = await api.get('/users');

    // Then - the whole response, and the one property this test is about
    expect(result.response).toMatch(`
        HTTP/1.1 200 OK

        {"users": []}
    `);
    expect(result.response.body).toStrictEqual({ users: [] });
});
});
