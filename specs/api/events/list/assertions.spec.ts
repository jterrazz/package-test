import { describe, expect, test } from 'vitest';

import { file } from '../../../../src/index.js';
import { api } from '../../api.specification.js';

// ── Critical path — both node and compose ──

// ── Edge cases ──

/*
 * These probe the framework's OWN mismatch-diff error messages — the diff
 * formatting IS the product surface under test, so it is goldened in full
 * (expected/*-error.txt) rather than reconstructed line-by-line via probes.
 * The passing paths already assert whole-response correctness via .toMatch(file('./expected/<file>.http')).
 */

// ── Table assertions ──

describe('assertions', () => {
    // ── Detailed table assertions ──

    test('table details — queries a specific database by key', async () => {
        // Given - seed analytics directly
        const result = await api
            .seed(file('./seeds/two-events.sql'), { database: 'analyticsDb' })
            .get('/events');

        // Then - multi-column check on analytics-db
        await expect(result.table('events', { database: 'analyticsDb' })).toMatch([
            [1, 'user_created', '{"name":"Alice"}', '{{iso8601}}'],
            [2, 'user_created', '{"name":"Bob"}', '{{iso8601}}'],
        ]);
    });
});
