import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { api } from '../../api.specification.js';

describe('listing', () => {
    test('lists the orders', async () => {
        // Given - the orders the specs root shares
        const result = await api.seed(file('./_seeds/orders.sql')).get('/orders');

        // Then - the whole list, twice over
        expect(result.response).toMatch(file('./_expected/listed.http'));
    });

    test('lists them again', async () => {
        // Given - the same orders
        const result = await api.seed(file('./_seeds/orders.sql')).get('/orders');

        // Then - the same list
        expect(result.response).toMatch(file('./_expected/listed.http'));
    });
});
