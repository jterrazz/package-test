import { expect, test } from 'vitest';

import { jobs } from '../jobs.specification.js';

test('the job stamps the instant the chain stated', async () => {
    // Given - a chain that pins the calendar before the job runs
    const result = await jobs.clock('2026-03-04T09:30:00Z').trigger('stamp-now');

    // Then - the job's own `new Date()` read that instant, and wrote it
    await expect(result.table('events', { database: 'analyticsDb' })).toMatchRows({
        columns: ['type'],
        rows: [['2026-03-04T09:30:00.000Z']],
    });
});
