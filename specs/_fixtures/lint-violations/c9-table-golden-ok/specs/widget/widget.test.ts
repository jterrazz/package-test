import { describe, expect, test } from 'vitest';

import { api } from '../../setup/db.specification.js';

const CASES = [{ name: '01-empty' }, { name: '02-one' }, { name: '03-many' }];

describe('widget', () => {
    test.each(CASES)('answers $name', async ({ name }) => {
        // Given - one row of the table, naming its own golden
        const result = await api.get('/');

        // Then - the golden is named by the row, not by a hand-written literal
        expect(result.body).toMatch(`${name}.json`, { frozen: true });
    });
});
