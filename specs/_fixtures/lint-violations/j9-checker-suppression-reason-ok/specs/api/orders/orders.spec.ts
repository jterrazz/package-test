import { expect, test } from 'vitest';

import { api } from '../api.specification.js';

test('answers the order', async () => {
    // Given - an order the seed placed
    // checker-disable-next-line a7 -- one database here, and the seed names it for the reader
    const result = await api.seed('orders.sql').get('/orders/1');
    // Then - the response states the total
    expect(result.response.body).toContain('3');
});
