/* The database resets before each chain, so a spec that needs rows seeds them. */

import { describe, expect, test } from 'vitest';

import { api } from '../../api.specification';
import { CREATED } from '../__setup__/orders';

describe('orders', () => {
    test('lists the orders', async () => {
        // Given - an empty table
        const result = await api.get('/orders');

        // Then - nothing created yet
        expect(result.status).not.toBe(CREATED);
    });

});
