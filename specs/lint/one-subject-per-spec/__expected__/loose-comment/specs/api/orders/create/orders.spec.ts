import { describe, expect, test } from 'vitest';

import { api } from '../../api.specification';
import { CREATED } from '../__setup__/orders';

describe('orders', () => {

    test('creates an order', async () => {
        // Given - an empty table
        const result = await api.post('/orders', { item: 'book' });

        // Then - created
        expect(result.status).toBe(CREATED);
    });
});
