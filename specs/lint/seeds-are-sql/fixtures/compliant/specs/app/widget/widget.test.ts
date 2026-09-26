import { describe, expect, test } from 'vitest';
import { file } from '@jterrazz/test';

import { api } from '../../setup/api.specification.js';

describe('widget', () => {
test('lists seeded users', async () => {
    // Given - one seeded user
    const result = await api.seed(file('./seeds/one-user.sql')).get('/users'); // checker-disable-line ground-shared-or-inline -- an input tree of the seeds-are-sql spec: its file form is what the rule reads

    // Then - listed
    expect(result.response.status).toBe(200); // oxlint-disable-line jterrazz/result-compared-whole -- an input tree of the seeds-are-sql spec: the probe is incidental to the rule it feeds
});
});
