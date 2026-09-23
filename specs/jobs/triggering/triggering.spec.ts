import { describe, expect, test } from 'vitest';

import { file, http } from '../../../src/index.js';
import { jobs } from '../jobs.specification.js';
import { jobs as staticJobs, staticRuns } from '../static-jobs.specification.js';

// Jobs run in-process by definition (CONVENTIONS A8) — specification.jobs()
// Has no mode: the same runner works regardless of TEST_MODE.

describe('jobs', () => {
    test('trigger resets databases at the start of each chain', async () => {
        // Given - a previous spec left synced events behind
        await jobs.seed(file('./seeds/two-users.sql'), { database: 'db' }).trigger('sync-events');
        const result = await jobs.trigger('sync-events');

        // Then - no users were seeded this time, so no events were produced
        await expect(result.table('events', { database: 'analyticsDb' })).toBeEmpty();
    });

    test('trigger rejects unknown job names', async () => {
        // Given - a job name that was never registered
        // Then - the error lists every available job, in registration order
        await expect(jobs.trigger('nope')).rejects.toThrow(
            'trigger("nope"): job not found. Available: sync-events, crash-after-insert, enrich-from-api, stamp-now',
        );
    });

    test('accepts a static array of jobs', async () => {
        // Given - a runner declared with a static JobHandle[] (no factory, no services)
        await staticJobs.trigger('record-run');

        // Then - the static job executed
        expect(staticRuns).toContain('record-run');
    });
});

describe('jobs — intercepts (D7)', () => {
    test('strict by default: an outgoing request matching no intercept fails the trigger', async () => {
        // Given - an intercept is declared, but for a DIFFERENT url than the job calls, so the chain's network is guarded (D7) yet the job's real request matches nothing
        // Then - the trigger rejects, naming the offending request rather than letting it reach the network
        await expect(
            jobs
                .intercept(http.get('https://not.the.url.test/other'), http.json({ label: 'x' }))
                .trigger('enrich-from-api'),
        ).rejects.toThrow(/Unmatched outgoing HTTP request[\s\S]*enrich\.example\.test/u);
    });
});
