import { expect, test } from 'vitest';
import { file } from '@jterrazz/test';

import { api } from '../../setup/api.specification.js';

test('creates a user', async () => {
    // Given - a complete request file
    const result = await api.request(file('./requests/create-user.http')); // checker-disable-line c28 -- an input tree of the c2-request-extension spec: its file form is what the rule reads

    // Then - created
    expect(result.response.status).toBe(201); // oxlint-disable-line jterrazz/d20-whole-result -- an input tree of the c2-request-extension spec: the probe is incidental to the rule it feeds
});
