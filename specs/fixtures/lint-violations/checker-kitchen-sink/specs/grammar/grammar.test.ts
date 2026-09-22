import { describe, expect, test } from 'vitest';
import { file } from '@jterrazz/test';

import { api } from '../setup/multi.specification.js';

describe('grammar', () => {
    test('exercises the fixture-grammar passes', async () => {
        // Given - a request fixture and a seed
        const result = await api.seed(file('./seeds/used.sql'), { database: 'db' }).request(file('./requests/req.http'));

        // Then - the expected snapshot is asserted
        expect(result.stdout).toMatch(file('./expected/out.txt'));
    });
});
