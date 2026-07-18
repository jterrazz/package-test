import { describe, expect, test } from 'vitest';

import { api } from '../setup/single.specification.js';

describe('widget', () => {
    test('names a database when only one is declared', async () => {
        // Given - a single SQL database but the seed redundantly names it
        const result = await api.seed('x.sql', { database: 'db' }).get('/');

        // Then - the response is defined
        expect(result).toBeDefined();
    });
});
