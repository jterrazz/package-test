import { describe, expect, test } from 'vitest'; // checker-disable-line spec-in-subject-folder -- an input of no-duplicate-ground: this folder is the case the rule reads, not a subject's standard name
import { file } from '@jterrazz/test';

import { api } from '../api.specification.js';

const route = `/${'orders'}`;

describe('orders', () => {
test('lists the orders of the two users', async () => {
    // Given - the two users
    const result = await api.seed(file('./seeds/two-users.sql')).get(route); // checker-disable-line ground-shared-or-inline -- an input tree of the no-duplicate-ground spec: its file form is what the rule reads

    // Then - it answered
    expect(result.response.text).toMatch(`
        HTTP/1.1 200 OK
    `);
});
});
