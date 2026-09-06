import { describe, expect, test } from 'vitest';

import { api } from '../setup/multi.specification.js';

describe('widget', () => {
    test('suppresses the A7 database requirement with a reason', async () => {
        // Given - two databases but the check is deliberately suppressed
        // checker-disable-next-line a7 -- legacy seed touches both schemas
        const result = await api.seed('x.sql').get('/');

        // Then - the response is defined
        expect(result).toBeDefined();
    });
});
