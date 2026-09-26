import { describe, expect, test } from 'vitest';
import { file } from '@jterrazz/test';

import { api } from '../setup/multi.specification.js';

describe('widget', () => {
    test('suppresses the A7 database requirement with a reason', async () => {
        // Given - two databases but the check is deliberately suppressed
        // checker-disable-next-line database-named-only-when-several -- legacy seed touches both schemas
        const result = await api.seed(file('./seeds/x.sql')).get('/'); // checker-disable-line ground-shared-or-inline -- an input tree of the checker spec: its file form is what the rule reads

        // Then - the response is defined
        expect(result).toBeDefined();
    });
});
