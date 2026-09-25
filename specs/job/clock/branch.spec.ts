import { describe, expect, test } from 'vitest';

import { job } from '../job.specification.js';

describe('branch', () => {
    test('a clock pinned on a branch never reaches the chain it forked from', async () => {
        // Given - a chain pinned at an instant, and a branch of it pinned at another, triggered first
        const pinned = job.clock('2026-03-04T09:30:00.000Z');
        await pinned.clock('2027-01-01T00:00:00.000Z').trigger('stamp-now');

        // When - the chain it forked from is triggered
        const result = await pinned.trigger('stamp-now');

        // Then - the job read the chain's own instant, never the branch's
        await expect(result.table('events', { database: 'analyticsDb' })).toMatch([
            [1, '2026-03-04T09:30:00.000Z', '{}', '{{iso8601}}'],
        ]);
    });
});
