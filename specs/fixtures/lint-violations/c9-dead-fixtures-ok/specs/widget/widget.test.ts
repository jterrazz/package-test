import { describe, expect, test } from 'vitest';

import { api } from '../../setup/db.specification.js';

describe('widget', () => {
    test('uses a single seed', async () => {
        // Given - one referenced seed
        const result = await api.seed('used.sql').get('/');

        // Then - the response is defined
        expect(result).toBeDefined();
    });
});
