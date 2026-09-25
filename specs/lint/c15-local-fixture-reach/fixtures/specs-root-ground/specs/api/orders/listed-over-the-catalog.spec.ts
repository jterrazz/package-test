import { file } from '@jterrazz/test'; // checker-disable-line c30 -- an input of C15: this folder is the case the rule reads, not a subject's standard name
import { describe, expect, test } from 'vitest';

import { api } from '../api.specification.js';

describe('listed-over-the-catalog', () => {
test("orders are listed over the shared catalog and this leaf's delta", async () => {
    // Given - the seeds it stands on
    const result = await api
        .seed(file('../../shared/seeds/catalog.sql'))
        .seed(file('./seeds/delta.sql')) // checker-disable-line c28 -- an input tree of the c15-local-fixture-reach spec: its file form is what the rule reads
        .get('/orders');

    // Then - the app answered
    expect(result.status).toBe(200);
});
});
