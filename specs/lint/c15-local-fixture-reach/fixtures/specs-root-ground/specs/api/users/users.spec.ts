import { expect, test } from 'vitest';
import { file } from '@jterrazz/test';

import { api } from '../api.specification.js';

test('lists the catalog users', async () => {
    // Given - the catalog the specs root shares
    const result = await api.seed(file('../../seeds/catalog.sql')).get('/users');

    // Then - the listing
    expect(result.status).toBe(200);
});
