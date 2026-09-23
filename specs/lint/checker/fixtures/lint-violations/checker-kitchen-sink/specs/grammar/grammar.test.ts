import { describe, expect, test } from 'vitest';
import { file } from '@jterrazz/test';

import { api } from '../setup/multi.specification.js';

describe('grammar', () => {
    test('exercises the fixture-grammar passes', async () => {
        // Given - a request fixture and a seed
        const result = await api.seed(file('./seeds/used.sql'), { database: 'db' }).request(file('./requests/req.http')); // checker-disable-line c28 -- an input tree of the checker spec: its file form is what the rule reads

        // Then - the expected snapshot is asserted
        expect(result.stdout).toMatch(file('./expected/out.txt')); // checker-disable-line c28 -- an input tree of the checker spec: its file form is what the rule reads
    });
});
