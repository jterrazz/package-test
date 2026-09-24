import { file } from '@jterrazz/test'; // checker-disable-line c30 -- an input of C9: this folder is the case the rule reads, not a subject's standard name
import { expect, test } from 'vitest';

import { api } from '../api.specification.js';

test('the users are listed over their own two users and the shared one', async () => {
    // Given - the seeds it stands on
    const result = await api
        .seed(file('./seeds/two-users.sql')) // checker-disable-line c28 -- an input tree of the checker spec: its file form is what the rule reads
        .seed(file('../../shared/seeds/one-user.sql'))
        .get('/users');

    // Then - the app answered
    expect(result.status).toBe(200);
});
