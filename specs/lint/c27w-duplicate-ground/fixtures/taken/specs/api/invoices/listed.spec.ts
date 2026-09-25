import { file } from '@jterrazz/test'; // checker-disable-line c30 -- an input of C27: this folder is the case the rule reads, not a subject's standard name
import { describe, expect, test } from 'vitest';

import { api } from '../api.specification.js';

describe('listed', () => {
test('the invoices are listed over the shared users', async () => {
    // Given - the seeds it stands on
    const result = await api
        .seed(file('../../shared/seeds/two-users.sql'))
        .get('/invoices');

    // Then - the app answered
    expect(result.status).toBe(200);
});
});
