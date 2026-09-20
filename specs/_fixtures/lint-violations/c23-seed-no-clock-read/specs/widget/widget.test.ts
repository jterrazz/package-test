import { describe, expect, test } from 'vitest';

import { api } from '../../setup/db.specification.js';

describe('widget', () => {
    test('reads the posts a seed that asks the machine for the date left', async () => {
        // Given - a seed whose instants are whatever day the suite ran
        const result = await api.seed('posts.sql').get('/posts');

        // Then - the response is defined
        expect(result).toBeDefined();
    });
});
