import { describe, expect, test } from 'vitest';

import { api } from '../../setup/db.specification.js';

const name = 'users';

describe('widget', () => {
    test('seeds from a computed name', async () => {
        // Given - a non-literal seed reference (the checker cannot resolve it)
        const result = await api.seed(`${name}.sql`).get('/');

        // Then - the response is defined
        expect(result).toBeDefined();
    });
});
