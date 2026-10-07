/* The database resets before each chain, so a spec that needs rows seeds them. */

import { describe, expect, test } from 'vitest';

import { api } from '../api.specification';

const CREATED = 201;

describe('orders', () => {
    test('lists the orders', async () => {
        // Given - an empty table
        const result = await api.get('/orders');

        // Then - nothing created yet
        expect(result.status).not.toBe(CREATED);
    });

    test('creates an order', async () => {
        // Given - an empty table
        const result = await api.post('/orders', { item: 'book' });

        // Then - created
        expect(result.status).toBe(CREATED);
    });
});
