import { expect, test } from 'vitest'; // checker-disable-line c30 -- an input of C27: this folder is the case the rule reads, not a subject's standard name
import { file } from '@jterrazz/test';

import { api } from '../api.specification.js';

test('lists the pair of users', async () => {
    // Given - the pair
    const result = await api.seed(file('./seeds/pair.sql')).get('/users'); // checker-disable-line c28 -- an input tree of the c27w-duplicate-ground spec: its file form is what the rule reads

    // Then - it answered
    expect(result.status).toBe(200);
});
