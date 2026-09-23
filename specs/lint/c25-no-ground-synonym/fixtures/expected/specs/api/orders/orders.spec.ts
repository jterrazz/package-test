import { file } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { api } from '../api.specification.js';

test('lists the orders', async () => {
    // Given - no order placed
    const result = await api.get('/orders');

    // Then - the golden the leaf keeps in expected/
    expect(result.response).toMatch(file('./expected/orders.http')); // checker-disable-line c28 -- an input tree of the c25-no-ground-synonym spec: its file form is what the rule reads
});
