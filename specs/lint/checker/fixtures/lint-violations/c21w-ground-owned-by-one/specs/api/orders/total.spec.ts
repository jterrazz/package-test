import { expect, test } from 'vitest'; // checker-disable-line c30 -- an input of C21: this folder is the case the rule reads, not a subject's standard name
import { file } from '@jterrazz/test';

import { api } from '../api.specification.js';

test('answers the total of the order', async () => {
    // Given - an order with two lines
    const result = await api.get('/orders/1');
    // Then - the whole answer is pinned
    expect(result.response.body).toMatch(file('./expected/total.json')); // checker-disable-line c28 -- an input tree of the checker spec: its file form is what the rule reads // oxlint-disable-line jterrazz/d20-whole-result -- an input tree of the checker spec: the probe is incidental to the rule it feeds // oxlint-disable-line jterrazz/d20-whole-result -- an input tree of the c21w spec: the probe is incidental to the rule it feeds
});
