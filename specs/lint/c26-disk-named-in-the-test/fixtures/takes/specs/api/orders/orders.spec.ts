import { file } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { seeded } from './seeded.js';

test('lists the seeded orders', async () => {
    // Given - the rows this spec stands on, named on its own line
    const result = await seeded(file('./seeds/orders.sql')).get('/orders'); // checker-disable-line c28 -- an input tree of the c26-disk-named-in-the-test spec: its file form is what the rule reads

    // Then - the orders are listed
    expect(result.response).toMatch(file('./expected/orders.http')); // checker-disable-line c28 -- an input tree of the c26-disk-named-in-the-test spec: its file form is what the rule reads
});
