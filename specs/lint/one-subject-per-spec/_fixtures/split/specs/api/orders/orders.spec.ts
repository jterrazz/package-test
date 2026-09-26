import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { api } from '../api.specification.js';

const ORDER = { item: 'book' };

describe('orders', () => {
    test('lists the orders', async () => {
        // Given - one order
        const result = await api.seed(file('./_seeds/one-order.sql')).get('/orders');

        // Then - the whole list
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('creates an order', async () => {
        // Given - an empty table
        const result = await api.post('/orders', ORDER);

        // Then - the whole response
        expect(result.response).toMatch(`HTTP/1.1 201 Created`);
    });
});
