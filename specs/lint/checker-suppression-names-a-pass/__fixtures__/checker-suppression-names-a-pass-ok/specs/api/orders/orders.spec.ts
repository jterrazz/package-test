import { describe, expect, test } from 'vitest'; // checker-disable-line spec-in-subject-folder -- an input of checker-suppression-names-a-pass: this folder is the case the rule reads, not a subject's standard name
import { file } from '@jterrazz/test';

import { api } from '../api.specification.js';

describe('orders', () => {
test('answers the order', async () => {
    // Given - an order the seed placed
    // checker-disable-next-line database-named-only-when-several -- one database here, and the seed names it for the reader
    const result = await api.seed(file('./__seeds__/orders.sql')).get('/orders/1'); // checker-disable-line ground-shared-or-inline -- an input tree of the checker spec: its file form is what the rule reads
    // Then - the response states the total
    expect(result.response.body).toContain('3'); // oxlint-disable-line jterrazz/result-compared-whole -- an input tree of the checker spec: the probe is incidental to the rule it feeds
});
});
