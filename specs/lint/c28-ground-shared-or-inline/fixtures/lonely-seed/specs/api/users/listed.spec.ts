import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { api } from '../api.specification.js';

describe('listed', () => {
test('the users are listed over a seed only this leaf reaches for', async () => {
    // Given - the seed the leaf's two tests share
    const result = await api.seed(file('../../shared/seeds/one-user.sql')).get('/users');

    // Then - the app answered
    expect(result.status).toBe(200);
});

test('the users are counted over the same seed', async () => {
    // Given - the same seed
    const result = await api.seed(file('../../shared/seeds/one-user.sql')).get('/users/count'); // checker-disable-line c29 -- an input of C28: its tests reach two subjects on purpose

    // Then - the app answered
    expect(result.status).toBe(200);
});
});
