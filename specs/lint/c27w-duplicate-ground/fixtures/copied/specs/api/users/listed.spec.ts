import { file } from '@jterrazz/test'; // checker-disable-line c30 -- an input of C27: this folder is the case the rule reads, not a subject's standard name
import { describe, expect, test } from 'vitest';

import { api } from '../api.specification.js';

describe('listed', () => {
test('the users are listed over their two users', async () => {
    // Given - the seeds it stands on
    const result = await api
        .seed(file('./seeds/two-users.sql')) // checker-disable-line c28 -- an input tree of the c27w-duplicate-ground spec: its file form is what the rule reads
        .get('/users');

    // Then - the app answered
    expect(result.status).toBe(200);
});
});
