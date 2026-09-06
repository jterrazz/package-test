import { describe, expect, test } from 'vitest';

import { api } from '../setup/multi.specification.js';

describe('widget', () => {
    test('seeds without naming the database', async () => {
        // Given - two SQL databases are declared but no database is named
        const result = await api.seed('x.sql').get('/');

        // Then - the response is defined
        expect(result).toBeDefined();
    });
});
