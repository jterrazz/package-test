import { file } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { api } from '../api.specification.js';

test('the users are listed over their own two users and the shared one', async () => {
    // Given - the seeds it stands on
    const result = await api
        .seed(file('./seeds/two-users.sql'))
        .seed(file('../../seeds/one-user.sql'))
        .get('/users');

    // Then - the app answered
    expect(result.status).toBe(200);
});
