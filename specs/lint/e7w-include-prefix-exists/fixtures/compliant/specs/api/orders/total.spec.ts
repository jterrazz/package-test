import { expect, test } from 'vitest';

import { api } from '../api.specification.js';

test('answers the total of the order', async () => {
    // Given - an order with two lines
    const result = await api.get('/orders/1');
    // Then - the response states the total
    expect(result.status).toBe(200);
    expect(result.response.body).toContain('3');
});
