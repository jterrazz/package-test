import { expect, test } from 'vitest';

import { api } from '../../api.specification.js';

test('answers the total of the order', async () => {
    // Given - an order with two lines
    const result = await api.get('/orders/1');
    // Then - the whole answer is pinned
    expect(result.response.body).toMatch('total.json');
});
