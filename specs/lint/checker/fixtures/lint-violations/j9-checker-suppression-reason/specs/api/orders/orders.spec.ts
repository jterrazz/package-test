import { expect, test } from 'vitest';
import { file } from '@jterrazz/test';

import { api } from '../api.specification.js';

test('answers the order', async () => {
    // Given - an order the seed placed
    // checker-disable-next-line a7
    const result = await api.seed(file('./seeds/orders.sql')).get('/orders/1');
    // Then - the response states the total
    expect(result.response.body).toContain('3');
});
