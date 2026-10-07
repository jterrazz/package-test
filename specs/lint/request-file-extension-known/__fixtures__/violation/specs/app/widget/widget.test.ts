import { describe, expect, test } from 'vitest';
import { file } from '@jterrazz/test';

import { api } from '../../setup/api.specification.js';

describe('widget', () => {
test('creates a user', async () => {
    // Given - a complete request file
    const result = await api.request(file('./__requests__/create-user.http')); // checker-disable-line ground-shared-or-inline -- an input tree of the request-file-extension-known spec: its file form is what the rule reads

    // Then - created
    expect(result.response.status).toBe(201); // oxlint-disable-line jterrazz/result-compared-whole -- an input tree of the request-file-extension-known spec: the probe is incidental to the rule it feeds
});
});
