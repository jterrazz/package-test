import { expect, test } from 'vitest';
import { file } from '@jterrazz/test';

import { api } from '../../setup/api.specification.js';

test('lists seeded users', async () => {
    // Given - one seeded user
    const result = await api.seed(file('./seeds/one-user.sql')).get('/users'); // checker-disable-line c28 -- an input tree of the c7-seeds-sql-only spec: its file form is what the rule reads

    // Then - listed
    expect(result.response.status).toBe(200); // oxlint-disable-line jterrazz/d20-whole-result -- an input tree of the c7-seeds-sql-only spec: the probe is incidental to the rule it feeds
});
