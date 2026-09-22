import { expect, test } from 'vitest';
import { file } from '@jterrazz/test';

import { api } from '../../setup/api.specification.js';

test('creates a user', async () => {
    // Given - a complete request file
    const result = await api.request(file('./requests/create-user.http'));

    // Then - created
    expect(result.response.status).toBe(201);
});
