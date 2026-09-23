import { expect, test } from 'vitest';
import { file } from '@jterrazz/test';

import { api } from '../api.specification.js';

test('lists the orders of the two users', async () => {
    // Given - the two users
    const result = await api.seed(file('./seeds/two-users.sql')).get('/orders');

    // Then - it answered
    expect(result.status).toBe(200);
});
