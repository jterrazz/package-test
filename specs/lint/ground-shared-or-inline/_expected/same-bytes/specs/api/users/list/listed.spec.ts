import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { api } from '../../api.specification.js';

describe('listed', () => {
test('lists everyone', async () => {
    // Given - one user, its SQL the bytes its seed file already holds
    const result = await api.seed(file('./_seeds/lists-everyone.sql')).get('/users');

    // Then - the users, past the expected cap, the bytes their golden already holds
    expect(result.json).toMatch(file('./_expected/lists-everyone.json'));
});
});
