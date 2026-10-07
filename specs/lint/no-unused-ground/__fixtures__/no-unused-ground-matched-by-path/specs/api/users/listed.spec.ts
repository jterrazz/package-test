import { file } from '@jterrazz/test'; // checker-disable-line spec-in-subject-folder -- an input of no-unused-ground: this folder is the case the rule reads, not a subject's standard name
import { describe, expect, test } from 'vitest';

import { api } from '../api.specification.js';

describe('listed', () => {
test('the users are listed over their own two users and the shared one', async () => {
    // Given - the seeds it stands on
    const result = await api
        .seed(file('./__seeds__/two-users.sql')) // checker-disable-line ground-shared-or-inline -- an input tree of the checker spec: its file form is what the rule reads
        .seed(file('../../__seeds__/one-user.sql'))
        .get('/users');

    // Then - the app answered
    expect(result.status).toBe(200);
});
});
