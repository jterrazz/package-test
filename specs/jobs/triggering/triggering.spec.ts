import { describe, expect, test } from 'vitest';

import { file, http, sql } from '../../../src/index.js';
import { analyticsHandle, jobs } from '../jobs.specification.js';
import { jobs as staticJobs, staticRuns } from '../static-jobs.specification.js';

// Jobs run in-process by definition (CONVENTIONS A8) — specification.jobs()
// Has no mode: the same runner works regardless of TEST_MODE.

describe('jobs', () => {
    test('trigger resets databases at the start of each chain', async () => {
        // Given - a previous spec left synced events behind
        await jobs
            .seed(file('../../seeds/two-users.sql'), { database: 'db' })
            .trigger('sync-events');
        const result = await jobs.trigger('sync-events');

        // Then - no users were seeded this time, so no events were produced
        await expect(result.table('events', { database: 'analyticsDb' })).toBeEmpty();
    });

    test('a job reads the state a seed written in the test laid', async () => {
        // Given - one user, written in the test
        const result = await jobs
            .seed(
                sql`
                    INSERT INTO "users" (name, email) VALUES ('Ada', 'ada@test.com');
                `,
                { database: 'db' },
            )
            .trigger('sync-events');

        // Then - the job synced that one user
        await expect(result.table('events', { database: 'analyticsDb' })).toMatch([
            [1, 'user_synced', '{"name":"Ada"}', '{{iso8601}}'],
        ]);
    });

    test('the job copies one event per seeded user', async () => {
        // Given - the two users the specs root shares
        const result = await jobs
            .seed(file('../../seeds/two-users.sql'), { database: 'db' })
            .trigger('sync-events');

        // Then - one synced event each, in order
        await expect(result.table('events', { database: 'analyticsDb' })).toMatch([
            [1, 'user_synced', '{"name":"Alice"}', '{{iso8601}}'],
            [2, 'user_synced', '{"name":"Bob"}', '{{iso8601}}'],
        ]);
    });

    test('a job that crashes rejects the trigger with its own error, and what it wrote first stays', async () => {
        // Given - a job that writes one row, then throws
        const run = jobs.trigger('crash-after-insert');

        // Then - the trigger rejects with the job's error, and the row written before stays
        await expect(run).rejects.toThrow('crash-after-insert: boom');
        await expect(
            analyticsHandle.query('events', ['id', 'type', 'payload']),
        ).resolves.toStrictEqual([[1, 'pre_crash', '{}']]);
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
    test("the job's outgoing call is answered by the contract the chain declares", async () => {
        // Given - the one call the job makes out, answered in place
        const result = await jobs
            .intercept(
                http.get('https://enrich.example.test/label'),
                http.json({ label: 'enriched' }),
            )
            .trigger('enrich-from-api');

        // Then - the job stored what the contract answered
        await expect(result.table('events', { database: 'analyticsDb' })).toMatch([
            [1, 'enriched', '{}', '{{iso8601}}'],
        ]);
    });

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
