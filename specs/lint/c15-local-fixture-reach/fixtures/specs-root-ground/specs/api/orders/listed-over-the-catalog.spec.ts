import { file } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { api } from '../api.specification.js';

test("orders are listed over the shared catalog and this leaf's delta", async () => {
    // Given - the seeds it stands on
    const result = await api
        .seed(file('../../seeds/catalog.sql'))
        .seed(file('./seeds/delta.sql'))
        .get('/orders');

    // Then - the app answered
    expect(result.status).toBe(200);
});
