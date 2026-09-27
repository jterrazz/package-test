import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { api } from '../../api.specification.js';

describe('orders', () => {
    test('lists the orders', async () => {
        // Given - one order
        const result = await api.seed(file('./_seeds/one-order.sql')).get('/orders');

        // Then - the whole list
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

});
