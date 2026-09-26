import { file } from '@jterrazz/test'; // checker-disable-line spec-in-subject-folder -- an input of no-duplicate-ground: this folder is the case the rule reads, not a subject's standard name
import { describe, expect, test } from 'vitest';

import { api } from '../api.specification.js';

describe('listed', () => {
test('the payments are listed over the shared users', async () => {
    // Given - the seeds it stands on
    const result = await api
        .seed(file('../../shared/seeds/two-users.sql'))
        .get('/payments');

    // Then - the app answered
    expect(result.status).toBe(200);
});
});
