import { describe, expect, test } from 'vitest';

import { api } from '../setup/multi.specification.js';

describe('widget', () => {
    test('seeds naming the database', async () => {
        // Given - two SQL databases are declared and the seed names one
        const result = await api.seed('x.sql', { database: 'db' }).get('/');

        // Then - the response is defined
        expect(result).toBeDefined();
    });
});
