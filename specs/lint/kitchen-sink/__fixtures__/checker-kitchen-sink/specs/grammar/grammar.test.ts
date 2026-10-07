import { describe, expect, test } from 'vitest';
import { file } from '@jterrazz/test';

import { api } from '../db/multi.specification.js';

describe('grammar', () => {
    test('exercises the fixture-grammar passes', async () => {
        // Given - a request fixture and a seed
        const result = await api.seed(file('./__seeds__/used.sql'), { database: 'db' }).request(file('./__requests__/req.http')); // checker-disable-line ground-shared-or-inline -- an input tree of the checker spec: its file form is what the rule reads

        // Then - the expected snapshot is asserted
        expect(result.stdout).toMatch(file('./__expected__/out.txt')); // checker-disable-line ground-shared-or-inline -- an input tree of the checker spec: its file form is what the rule reads
    });
});
