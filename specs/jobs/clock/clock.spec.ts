import { describe, expect, test } from 'vitest';

import { jobs } from '../jobs.specification.js';

describe('clock', () => {
    test('the job stamps the instant the chain pins', async () => {
        // Given - a chain pinned at an instant
        const result = await jobs.clock('2026-03-04T09:30:00.000Z').trigger('stamp-now');

        // Then - the job read that instant
        await expect(result.table('events', { database: 'analyticsDb' })).toMatch([
            [1, '2026-03-04T09:30:00.000Z', '{}', '{{iso8601}}'],
        ]);
    });

    test('a view made with() pins every trigger it starts', async () => {
        // Given - the instant a whole file shares
        const result = await jobs.with({ clock: '2026-03-04T09:30:00.000Z' }).trigger('stamp-now');

        // Then - the job read that instant
        await expect(result.table('events', { database: 'analyticsDb' })).toMatch([
            [1, '2026-03-04T09:30:00.000Z', '{}', '{{iso8601}}'],
        ]);
    });
});
