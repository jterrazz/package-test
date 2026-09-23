import { file } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { api } from '../api.specification.js';

test('the orders are listed over the shared user', async () => {
    // Given - the seeds it stands on
    const result = await api
        .seed(file('../../seeds/one-user.sql'))
        .get('/orders');

    // Then - the app answered
    expect(result.status).toBe(200);
});
