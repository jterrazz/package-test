import { file } from '@jterrazz/test'; // checker-disable-line spec-in-subject-folder -- an input of no-reach-into-sibling-ground: this folder is the case the rule reads, not a subject's standard name
import { describe, expect, test } from 'vitest';

import { api } from '../api.specification.js';

describe('listed-with-a-user', () => {
test('orders are listed against a user seeded from the users leaf', async () => {
    // Given - the seeds it stands on
    const result = await api
        .seed(file('../users/seeds/one-user.sql'))
        .get('/orders');

    // Then - the app answered
    expect(result.status).toBe(200);
});
});
