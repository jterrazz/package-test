import { describe, expect, test } from 'vitest';

import { job } from '../job.specification.js';
import { job as noJobs } from '../no-jobs.specification.js';

describe('unknown-job', () => {
    test('trigger rejects unknown job names', async () => {
        // Given - a job name that was never registered
        // Then - the error lists every available job, in registration order
        await expect(job.trigger('nope')).rejects.toThrow(
            [
                'found: .trigger("nope"), and no job is registered under that name',
                'why: A job is triggered by the name it is registered under.',
                'fix: trigger a registered job: sync-events, crash-after-insert, enrich-from-api, stamp-now',
                'read: docs/13-job.md#options',
            ].join('\n'),
        );
    });

    test('a runner that registered no job says where jobs are registered', async () => {
        // Given - a job runner handed an empty list
        // Then - the refusal names the option, rather than listing no job as available
        await expect(noJobs.trigger('report-refresh')).rejects.toThrow(
            [
                'found: .trigger("report-refresh"), and no job is registered',
                'why: A job is triggered by the name it is registered under.',
                'fix: register the jobs with the `jobs` option of specification.job()',
                'read: docs/13-job.md#options',
            ].join('\n'),
        );
    });
});
