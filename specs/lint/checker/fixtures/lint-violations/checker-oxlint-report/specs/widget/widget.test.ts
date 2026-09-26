import { describe, expect, test } from 'vitest';
import { file } from '@jterrazz/test';

import { api } from '../../setup/db.specification.js';

describe('widget', () => {
    test('uses a single seed', async () => {
        // Given - one referenced seed
        const result = await api.seed(file('./seeds/used.sql')).get('/'); // checker-disable-line ground-shared-or-inline -- an input tree of the checker spec: its file form is what the rule reads

        // Then - the response is defined
        expect(result).toBeDefined();
    });
});
