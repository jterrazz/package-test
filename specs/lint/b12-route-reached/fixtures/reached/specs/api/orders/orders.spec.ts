import { expect, test } from 'vitest';

import { api } from '../api.specification.js';

test('lists the orders', async () => {
    // Given - no order
    const result = await api.get('/orders');

    // Then - the listing answers
    expect(result.status).toBe(200);
});

test('creates an order', async () => {
    // Given - an order to create
    const result = await api.post('/orders', { item: 'book' });

    // Then - it is created
    expect(result.status).toBe(201);
});
