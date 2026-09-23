import { expect, test } from 'vitest';
import { file } from '@jterrazz/test';

import { api } from '../api.specification.js';

test('lists the pair of users', async () => {
    // Given - the pair
    const result = await api.seed(file('./seeds/pair.sql')).get('/users');

    // Then - it answered
    expect(result.status).toBe(200);
});
