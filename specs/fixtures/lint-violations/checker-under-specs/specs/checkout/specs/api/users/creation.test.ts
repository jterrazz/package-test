import { expect, test } from 'vitest';

import { api } from '../api.specification.js';

test('creates a user', async () => {
    // Given - a spec of the assembled product wearing the unit's suffix
    const result = await api.post('/users');
    // Then - C12 renames it
    expect(result.status).toBe(201);
});
