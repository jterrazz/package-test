import { file } from '@jterrazz/test'; // checker-disable-line spec-in-subject-folder -- an input of no-duplicate-ground: this folder is the case the rule reads, not a subject's standard name
import { describe, expect, test } from 'vitest';

import { api } from '../api.specification.js';

describe('listed', () => {
test('the users are listed over their two users', async () => {
    // Given - the seeds it stands on
    const result = await api
        .seed(file('./__seeds__/two-users.sql')) // checker-disable-line ground-shared-or-inline -- an input tree of the no-duplicate-ground spec: its file form is what the rule reads
        .get('/users');

    // Then - the app answered
    expect(result.status).toBe(200);
});
});
