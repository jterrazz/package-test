import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { seeded } from './seeded.js';

describe('orders', () => {
test('lists the seeded orders', async () => {
    // Given - the rows this spec stands on, named on its own line
    const result = await seeded(file('./__seeds__/orders.sql')).get('/orders'); // checker-disable-line ground-shared-or-inline -- an input tree of the paths-named-in-the-test spec: its file form is what the rule reads

    // Then - the orders are listed
    expect(result.response).toMatch(file('./__expected__/orders.http')); // checker-disable-line ground-shared-or-inline -- an input tree of the paths-named-in-the-test spec: its file form is what the rule reads
});
});
