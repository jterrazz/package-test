import { describe, expect, test } from 'vitest'; // checker-disable-line c30 -- an input of J9: this folder is the case the rule reads, not a subject's standard name
import { file } from '@jterrazz/test';

import { api } from '../api.specification.js';

describe('orders', () => {
test('answers the order', async () => {
    // Given - an order the seed placed
    // checker-disable-next-line a7
    const result = await api.seed(file('./seeds/orders.sql')).get('/orders/1'); // checker-disable-line c28 -- an input tree of the checker spec: its file form is what the rule reads
    // Then - the response states the total
    expect(result.response.body).toContain('3'); // oxlint-disable-line jterrazz/d20-whole-result -- an input tree of the checker spec: the probe is incidental to the rule it feeds
});
});
