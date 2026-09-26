import { describe, expect, test } from 'vitest';
import { file } from '@jterrazz/test';

import { api } from '../../api.specification.js';

describe('total', () => {
test('answers the total of the order', async () => {
    // Given - an order with two lines
    const result = await api.get('/orders/1');
    // Then - the whole answer is pinned
    expect(result.response.body).toMatch(file('./expected/total.json')); // checker-disable-line ground-shared-or-inline -- an input tree of the checker spec: its file form is what the rule reads // oxlint-disable-line jterrazz/result-compared-whole -- an input tree of the checker spec: the probe is incidental to the rule it feeds // oxlint-disable-line jterrazz/result-compared-whole -- an input tree of the ground-beside-its-only-reader spec: the probe is incidental to the rule it feeds
});
});
