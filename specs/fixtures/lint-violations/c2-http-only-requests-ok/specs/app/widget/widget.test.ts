import { expect, test } from 'vitest';

import { api } from '../../setup/api.specification.js';

test('creates a user', async () => {
    // Given - a complete request file
    const result = await api.request('create-user.http');

    // Then - created
    expect(result.response.status).toBe(201);
});
