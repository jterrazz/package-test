import { file } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { api } from '../api.specification.js';

test('the users are listed over their two users', async () => {
    // Given - the seeds it stands on
    const result = await api
        .seed(file('./seeds/two-users.sql'))
        .get('/users');

    // Then - the app answered
    expect(result.status).toBe(200);
});
