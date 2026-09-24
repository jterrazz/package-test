import { describe, expect, test } from 'vitest';

import { file } from '../../../src/index.js';
import { jobs } from '../jobs.specification.js';

// Jobs run in-process by definition (CONVENTIONS A8) — specification.jobs()
// Has no mode: the same runner works regardless of TEST_MODE.

describe('triggering', () => {
    test('trigger resets databases at the start of each chain', async () => {
        // Given - a previous spec left synced events behind
        await jobs
            .seed(file('../../shared/seeds/two-users.sql'), { database: 'db' })
            .trigger('sync-events');
        const result = await jobs.trigger('sync-events');

        // Then - no users were seeded this time, so no events were produced
        await expect(result.table('events', { database: 'analyticsDb' })).toBeEmpty();
    });

    test('a job reads the state its seed laid', async () => {
        // Given - one user, from the seed beside the test
        const result = await jobs
            .seed(file('./seeds/ada.sql'), { database: 'db' })
            .trigger('sync-events');

        // Then - the job synced that one user
        await expect(result.table('events', { database: 'analyticsDb' })).toMatch([
            [1, 'user_synced', '{"name":"Ada"}', '{{iso8601}}'],
        ]);
    });

    test('the job copies one event per seeded user', async () => {
        // Given - the two users the specs root shares
        const result = await jobs
            .seed(file('../../shared/seeds/two-users.sql'), { database: 'db' })
            .trigger('sync-events');

        // Then - one synced event each, in order
        await expect(result.table('events', { database: 'analyticsDb' })).toMatch([
            [1, 'user_synced', '{"name":"Alice"}', '{{iso8601}}'],
            [2, 'user_synced', '{"name":"Bob"}', '{{iso8601}}'],
        ]);
    });
});
