import { file } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { api } from '../api.specification.js';

test("orders are listed over the shared catalog and this leaf's delta", async () => {
    // Given - the seeds it stands on
    const result = await api
        .seed(file('../../seeds/catalog.sql'))
        .seed(file('./seeds/delta.sql')) // checker-disable-line c28 -- an input tree of the c15-local-fixture-reach spec: its file form is what the rule reads
        .get('/orders');

    // Then - the app answered
    expect(result.status).toBe(200);
});
