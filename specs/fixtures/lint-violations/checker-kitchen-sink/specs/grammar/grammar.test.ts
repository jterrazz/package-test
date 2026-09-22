import { describe, expect, test } from 'vitest';

import { api } from '../setup/multi.specification.js';

describe('grammar', () => {
    test('exercises the fixture-grammar passes', async () => {
        // Given - a request fixture and a seed
        const result = await api.seedFile('./seeds/used.sql', { database: 'db' }).requestFile('./requests/req.http');

        // Then - the expected snapshot is asserted
        expect(result.stdout).toMatchFile('./expected/out.txt');
    });
});
