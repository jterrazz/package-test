import { expect, test } from 'vitest';
import { file } from '@jterrazz/test';

import { api } from '../../api.specification.js';

test('answers the total of the order', async () => {
    // Given - an order with two lines
    const result = await api.get('/orders/1');
    // Then - the whole answer is pinned
    expect(result.response.body).toMatch(file('./expected/total.json')); // checker-disable-line c28 -- an input tree of the checker spec: its file form is what the rule reads
});
