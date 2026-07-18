import { describe, expect, test } from 'vitest';

import { http } from '../../../src/index.js';
import { analyticsUrl, jobs } from '../jobs.specification.js';
import { jobs as staticJobs, staticRuns } from '../static-jobs.specification.js';

// Jobs run in-process by definition (CONVENTIONS A5/A8) — specification.jobs()
// Has no mode: the same runner works regardless of TEST_MODE.

describe('jobs', () => {
    test('trigger executes a registered job', async () => {
        // Given - two users seeded, then the sync-events job runs
        const result = await jobs.seed('two-users.sql', { database: 'db' }).trigger('sync-events');

        // Then - the job copied one event per user into the analytics database
        await expect(result.table('events', { database: 'analyticsDb' })).toMatchRows({
            columns: ['payload', 'type'],
            rows: [
                ['{"name":"Alice"}', 'user_synced'],
                ['{"name":"Bob"}', 'user_synced'],
            ],
        });
    });

    test('trigger resets databases at the start of each chain', async () => {
        // Given - a previous spec left synced events behind
        await jobs.seed('two-users.sql', { database: 'db' }).trigger('sync-events');
        const result = await jobs.trigger('sync-events');

        // Then - no users were seeded this time, so no events were produced
        await expect(result.table('events', { database: 'analyticsDb' })).toBeEmpty();
    });

    test('trigger rejects unknown job names', async () => {
        // Given - a job name that was never registered
        // Then - the error lists every available job, in registration order
        await expect(jobs.trigger('nope')).rejects.toThrow(
            'trigger("nope"): job not found. Available: sync-events, crash-after-insert, enrich-from-api',
        );
    });

    test('a throwing job rejects the trigger with its own error', async () => {
        // Given - a registered job whose execute() writes one row then throws
        // Then - .trigger() surfaces the job's error verbatim
        await expect(jobs.trigger('crash-after-insert')).rejects.toThrow(
            'crash-after-insert: boom',
        );
    });

    test('database state written before a job crash stays observable', async () => {
        // Given - the crashing job rejected mid-execution
        await expect(jobs.trigger('crash-after-insert')).rejects.toThrow(
            'crash-after-insert: boom',
        );

        // Then - the row inserted before the crash is still in the analytics db
        // (queried directly — the rejected chain returned no result handle)
        const { Client } = await import('pg');
        const client = new Client({ connectionString: analyticsUrl() });
        await client.connect();
        try {
            const rows = await client.query('SELECT type FROM "events"');
            expect(rows.rows.map((r) => r.type)).toEqual(['pre_crash']);
        } finally {
            await client.end();
        }
    });

    test('accepts a static array of jobs', async () => {
        // Given - a runner declared with a static JobHandle[] (no factory, no services)
        await staticJobs.trigger('record-run');

        // Then - the static job executed
        expect(staticRuns).toContain('record-run');
    });
});

describe('jobs — intercepts (D7)', () => {
    test('a declared intercept feeds the triggered job its mocked HTTP response', async () => {
        // Given - the enrich job reaches out to an external API, which we intercept
        const result = await jobs
            .intercept(
                http.get('https://enrich.example.test/label'),
                http.json({ label: 'enriched' }),
            )
            .trigger('enrich-from-api');

        // Then - the job stored an event carrying the mocked label
        await expect(result.table('events', { database: 'analyticsDb' })).toMatchRows({
            columns: ['type'],
            rows: [['enriched']],
        });
    });

    test('strict by default: an outgoing request matching no intercept fails the trigger', async () => {
        // Given - an intercept is declared, but for a DIFFERENT url than the job calls,
        // So the chain's network is guarded (D7) yet the job's real request matches nothing
        // Then - the trigger rejects, naming the offending request rather than letting it
        // Reach the network
        await expect(
            jobs
                .intercept(http.get('https://not.the.url.test/other'), http.json({ label: 'x' }))
                .trigger('enrich-from-api'),
        ).rejects.toThrow(/Unmatched outgoing HTTP request[\s\S]*enrich\.example\.test/);
    });
});
