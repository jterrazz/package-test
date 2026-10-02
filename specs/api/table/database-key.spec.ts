import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { api } from '../api.specification.js';

describe('database-key', () => {
    test('table details — queries a specific database by key', async () => {
        // Given - seed analytics directly
        const result = await api
            .seed(file('../_seeds/two-events.sql'), { database: 'analyticsDb' })
            .get('/events');

        // Then - multi-column check on analytics-db
        await expect(result.table('events', { database: 'analyticsDb' })).toMatch([
            [1, 'user_created', '{"name":"Alice"}', '{{iso8601}}'],
            [2, 'user_created', '{"name":"Bob"}', '{{iso8601}}'],
        ]);
    });
});
