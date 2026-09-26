import { describe, expect, test } from 'vitest'; // checker-disable-line spec-in-subject-folder -- an input of file-suffix-matches-place: this folder is the case the rule reads, not a subject's standard name

import { api } from '../api.specification.js';

describe('creation', () => {
test('creates a user', async () => {
    // Given - a spec of the assembled product wearing the unit's suffix
    const result = await api.post('/users');
    // Then - `file-suffix-matches-place` renames it
    expect(result.status).toBe(201);
});
});
