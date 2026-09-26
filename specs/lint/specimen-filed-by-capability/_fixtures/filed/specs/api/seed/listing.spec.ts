import { describe, expect, test } from 'vitest';

import { api } from '../api.specification.js';

describe('listing', () => {
    test('lists the orders', async () => {
        // Given - no order
        const result = await api.get('/orders');

        // Then - the empty list
        expect(result.response).toMatch('HTTP/1.1 200 OK');
    });
});
