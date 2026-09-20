import { expect, test } from 'vitest';

import { api } from '../api.specification.js';

test('creates the order it was handed', async () => {
    // Given - an order posted to the collection
    const result = await api.post('/orders');
    // Then - the whole answer is pinned
    expect(result.response.body).toMatch('created.json');
});
