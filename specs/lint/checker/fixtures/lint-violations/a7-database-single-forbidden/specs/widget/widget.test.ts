import { describe, expect, test } from 'vitest';
import { file } from '@jterrazz/test';

import { api } from '../setup/single.specification.js';

describe('widget', () => {
    test('names a database when only one is declared', async () => {
        // Given - a single SQL database but the seed redundantly names it
        const result = await api.seed(file('./seeds/x.sql'), { database: 'db' }).get('/'); // checker-disable-line c28 -- an input tree of the checker spec: its file form is what the rule reads

        // Then - the response is defined
        expect(result).toBeDefined();
    });
});
