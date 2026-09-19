import { describe, expect, test } from 'vitest';

import { api } from '../../setup/db.specification.js';

const seedFile = 'users.sql';

describe('widget', () => {
    test('seeds from a computed name', async () => {
        // Given - a seed named by a bare binding: nothing in the source says
        // What file this is, so the checker's reference set is incomplete
        const result = await api.seed(seedFile).get('/');

        // Then - the response is defined
        expect(result).toBeDefined();
    });
});
