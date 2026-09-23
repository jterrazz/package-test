import { describe, expect, test } from 'vitest';

import { api } from '../api.specification.js';

const ITEM = 'book';

/** An order of the one item the catalogue sells. */
function order(): { item: string } {
    return { item: ITEM };
}

describe('orders', () => {
    test('creates an order', async () => {
        // Given - one order posted
        const result = await api.post('/orders', order());

        // Then - the whole answer
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('replaces an order', async () => {
        // Given - the first order replaced
        const result = await api.put('/orders/1', order());

        // Then - the whole answer
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });
});
