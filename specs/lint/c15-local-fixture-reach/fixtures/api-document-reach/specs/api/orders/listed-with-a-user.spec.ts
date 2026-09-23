import { file } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { api } from '../api.specification.js';

test('orders are listed against a user seeded from the users leaf', async () => {
    // Given - the seeds it stands on
    const result = await api
        .seed(file('../users/seeds/one-user.sql'))
        .get('/orders');

    // Then - the app answered
    expect(result.status).toBe(200);
});
