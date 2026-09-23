import { file } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { api } from '../api.specification.js';

test('the users are listed over a seed only this leaf reaches for', async () => {
    // Given - the seed the leaf's two tests share
    const result = await api.seed(file('../../seeds/one-user.sql')).get('/users');

    // Then - the app answered
    expect(result.status).toBe(200);
});

test('the users are counted over the same seed', async () => {
    // Given - the same seed
    const result = await api.seed(file('../../seeds/one-user.sql')).get('/users/count');

    // Then - the app answered
    expect(result.status).toBe(200);
});
