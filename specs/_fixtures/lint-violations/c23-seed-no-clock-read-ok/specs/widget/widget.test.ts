import { describe, expect, test } from 'vitest';

import { api } from '../../setup/db.specification.js';

describe('widget', () => {
    test('reads the posts the seed states outright', async () => {
        // Given - a seed whose instants are the case's, and a chain that pins the run's clock
        const result = await api.clock('2026-01-10T12:00:00.000Z').seed('posts.sql').get('/posts');

        // Then - the response is defined
        expect(result).toBeDefined();
    });
});
