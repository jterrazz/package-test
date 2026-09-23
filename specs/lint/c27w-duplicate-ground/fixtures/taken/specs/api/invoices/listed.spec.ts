import { file } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { api } from '../api.specification.js';

test('the invoices are listed over the shared users', async () => {
    // Given - the seeds it stands on
    const result = await api
        .seed(file('../../seeds/two-users.sql'))
        .get('/invoices');

    // Then - the app answered
    expect(result.status).toBe(200);
});
