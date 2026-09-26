import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { api } from '../../setup/db.specification.js';

const seed = file('./seeds/users.sql');

describe('widget', () => {
    test('seeds from a bound file', async () => {
        // Given - a seed handed to the verb through a binding: the call site
        // Names no path, so the checker's reference set is incomplete
        const result = await api.seed(seed).get('/');

        // Then - the response is defined
        expect(result).toBeDefined();
    });
});
