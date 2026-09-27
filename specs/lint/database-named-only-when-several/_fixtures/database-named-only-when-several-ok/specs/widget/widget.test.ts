import { describe, expect, test } from 'vitest';
import { file } from '@jterrazz/test';

import { api } from './multi.specification.js';

describe('widget', () => {
    test('seeds naming the database', async () => {
        // Given - two SQL databases are declared and the seed names one
        const result = await api.seed(file('./_seeds/x.sql'), { database: 'db' }).get('/'); // checker-disable-line ground-shared-or-inline -- an input tree of the checker spec: its file form is what the rule reads

        // Then - the response is defined
        expect(result).toBeDefined();
    });
});
