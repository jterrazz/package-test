import { file } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { seeded } from './seeded.js';

test('lists the seeded orders', async () => {
    // Given - the shared rows
    const result = await seeded().get('/orders');

    // Then - the orders are listed
    expect(result.response).toMatch(file('./expected/orders.http')); // checker-disable-line c28 -- an input tree of the c26-disk-named-in-the-test spec: its file form is what the rule reads
});
