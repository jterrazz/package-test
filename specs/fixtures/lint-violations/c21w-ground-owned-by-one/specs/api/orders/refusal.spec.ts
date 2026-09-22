import { expect, test } from 'vitest';

import { api } from '../api.specification.js';

test('refuses an order that does not exist', async () => {
    // Given - an order nobody placed
    const result = await api.get('/orders/404');
    // Then - the request is refused
    expect(result.status).toBe(404);
    expect(result.response.body).toContain('no such order');
});
