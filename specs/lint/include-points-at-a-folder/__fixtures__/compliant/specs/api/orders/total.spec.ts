import { describe, expect, test } from 'vitest';

import { api } from '../api.specification.js';

describe('total', () => {
test('answers the total of the order', async () => {
    // Given - an order with two lines
    const result = await api.get('/orders/1');
    // Then - the response states the total
    expect(result.status).toBe(200);
    expect(result.response.body).toContain('3'); // oxlint-disable-line jterrazz/result-compared-whole -- an input tree of the include-points-at-a-folder spec: the probe is incidental to the rule it feeds
});
});
