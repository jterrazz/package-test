import { expect, test } from 'vitest';
import { file } from '@jterrazz/test';

import { api } from '../../setup/api.specification.js';

test('lists seeded users', async () => {
    // Given - one seeded user
    const result = await api.seed(file('./seeds/one-user.sql')).get('/users');

    // Then - listed
    expect(result.response.status).toBe(200);
});
