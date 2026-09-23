import { describe, expect, test } from 'vitest';
import { file } from '@jterrazz/test';

import { api } from '../setup/multi.specification.js';

describe('db', () => {
    test('seeds without naming the database', async () => {
        // Given - two SQL databases are declared but none is named
        const result = await api.seed(file('./seeds/x.sql')).get('/');

        // Then - the response is defined
        expect(result).toBeDefined();
    });
});
