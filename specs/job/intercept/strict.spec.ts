import { describe, expect, test } from 'vitest';

import { http } from '../../../src/index.js';
import { job } from '../job.specification.js';

// Jobs run in-process by definition (CONVENTIONS A8) — specification.job()
// Has no mode: the same runner works regardless of TEST_MODE.

describe('strict', () => {
    test("the job's outgoing call is answered by the stub the chain declares", async () => {
        // Given - the one call the job makes out, answered in place
        const result = await job
            .intercept(
                http.get('https://enrich.example.test/label'),
                http.json({ label: 'enriched' }),
            )
            .trigger('enrich-from-api');

        // Then - the job stored what the stub answered
        await expect(result.table('events', { database: 'analyticsDb' })).toMatch([
            [1, 'enriched', '{}', '{{iso8601}}'],
        ]);
    });

    test('strict by default: an outgoing request matching no intercept fails the trigger', async () => {
        // Given - an intercept is declared, but for a DIFFERENT url than the job calls, so the chain's network is guarded (D7) yet the job's real request matches nothing
        // Then - the trigger rejects, naming the offending request rather than letting it reach the network
        await expect(
            job
                .intercept(http.get('https://not.the.url.test/other'), http.json({ label: 'x' }))
                .trigger('enrich-from-api'),
        ).rejects.toThrow(/an unmatched outgoing request, [\s\S]*enrich\.example\.test/u);
    });
});
