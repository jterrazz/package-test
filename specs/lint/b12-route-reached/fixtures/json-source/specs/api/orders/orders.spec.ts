import { expect, test } from 'vitest';

import { api } from '../api.specification.js';

test('lists the orders', async () => {
    // Given - no order
    const result = await api.get('/orders');

    // Then - the listing answers
    expect(result.status).toBe(200);
});
