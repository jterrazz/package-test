import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { seeded } from './seeded.js';

describe('orders', () => {
test('lists the seeded orders', async () => {
    // Given - the shared rows
    const result = await seeded().get('/orders');

    // Then - the orders are listed
    expect(result.response).toMatch(file('./expected/orders.http')); // checker-disable-line ground-shared-or-inline -- an input tree of the paths-named-in-the-test spec: its file form is what the rule reads
});
});
