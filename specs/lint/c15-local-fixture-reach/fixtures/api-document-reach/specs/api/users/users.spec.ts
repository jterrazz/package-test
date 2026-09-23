import { expect, test } from 'vitest';
import { file } from '@jterrazz/test';

import { api } from '../api.specification.js';

test('lists the seeded users', async () => {
    // Given - one user seeded
    const result = await api.seed(file('./seeds/one-user.sql')).get('/users');

    // Then - the listing
    expect(result.status).toBe(200);
});
