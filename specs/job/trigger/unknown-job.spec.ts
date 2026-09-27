import { describe, expect, test } from 'vitest';

import { job } from '../job.specification.js';

describe('unknown-job', () => {
    test('trigger rejects unknown job names', async () => {
        // Given - a job name that was never registered
        // Then - the error lists every available job, in registration order
        await expect(job.trigger('nope')).rejects.toThrow(
            [
                'found: .trigger("nope"), and no job is registered under that name',
                'why: A job is triggered by the name it is registered under.',
                'fix: trigger a registered job: sync-events, crash-after-insert, enrich-from-api, stamp-now',
                'read: docs/11-job.md#options',
            ].join('\n'),
        );
    });
});
