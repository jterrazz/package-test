import { expect, test } from 'vitest'; // checker-disable-line c30 -- an input of C21: this folder is the case the rule reads, not a subject's standard name

import { api } from '../api.specification.js';

test('refuses an order that does not exist', async () => {
    // Given - an order nobody placed
    const result = await api.get('/orders/404');
    // Then - the request is refused
    expect(result.status).toBe(404);
    expect(result.response.body).toContain('no such order'); // oxlint-disable-line jterrazz/d20-whole-result -- an input tree of the checker spec: the probe is incidental to the rule it feeds
});
