import { expect, test } from 'vitest';

import { api } from '../api.specification.js';

test('lists the users', async () => {
    // Given - an empty table
    const result = await api.get('/users');

    // Then - one probe, and nothing else of the response
    expect(result.response.body).toStrictEqual({ users: [] });
});
