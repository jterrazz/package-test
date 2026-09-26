import { describe, expect, test } from 'vitest'; // checker-disable-line spec-in-subject-folder -- an input of no-duplicate-ground: this folder is the case the rule reads, not a subject's standard name
import { file } from '@jterrazz/test';

import { api } from '../api.specification.js';

describe('users', () => {
test('lists the pair of users', async () => {
    // Given - the pair
    const result = await api.seed(file('./seeds/pair.sql')).get('/users'); // checker-disable-line ground-shared-or-inline -- an input tree of the no-duplicate-ground spec: its file form is what the rule reads

    // Then - it answered
    expect(result.status).toBe(200);
});
});
