import { describe, expect, test } from 'vitest'; // checker-disable-line spec-in-subject-folder -- an input of no-reach-into-sibling-ground: this folder is the case the rule reads, not a subject's standard name
import { file } from '@jterrazz/test';

import { api } from '../api.specification.js';

describe('users', () => {
test('lists the catalog users', async () => {
    // Given - the catalog the specs root shares
    const result = await api.seed(file('../../__seeds__/catalog.sql')).get('/users');

    // Then - the listing
    expect(result.status).toBe(200);
});
});
