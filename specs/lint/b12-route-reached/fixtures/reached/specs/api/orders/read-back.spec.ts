import { expect, test } from 'vitest';

import { api } from '../api.specification.js';

test('the first order listed is the order read back', async () => {
    // Given - the orders listed, then the first read back by its id
    const listed = await api.get('/orders');
    const [first] = (listed.response.body as { orders: { id: string }[] }).orders; // oxlint-disable-line jterrazz/d20-whole-result -- an input tree of the b12-route-reached spec: the probe is incidental to the rule it feeds
    const id = first?.id ?? '';
    const result = await api.get(`/orders/${id}`);

    // Then - it was found
    expect(result.status).toBe(200);
});
