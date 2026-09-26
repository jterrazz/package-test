import { describe, expect, test } from 'vitest';

import { TENANT } from '../../cli/_setup/tenant.js';
import { job } from '../job.specification.js';

describe('refresh', () => {
    test('runs refresh', async () => {
        // Given - no tenant refreshed
        const result = await job.trigger('refresh');

        // Then - the job succeeds, over what the setup holds
        expect(result.exitCode).toBe(0);
        expect(TENANT).toBeDefined();
    });
});
