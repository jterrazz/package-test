import { file } from '@jterrazz/test'; // checker-disable-line c30 -- an input of C25: this folder is the case the rule reads, not a subject's standard name
import { describe, expect, test } from 'vitest';

import { api } from '../api.specification.js';

describe('orders', () => {
test('lists the orders', async () => {
    // Given - no order placed
    const result = await api.get('/orders');

    // Then - the golden the leaf keeps in expected/
    expect(result.response).toMatch(file('./expected/orders.http')); // checker-disable-line c28 -- an input tree of the c25-no-ground-synonym spec: its file form is what the rule reads
});
});
