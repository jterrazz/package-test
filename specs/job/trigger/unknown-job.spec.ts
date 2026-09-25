import { describe, expect, test } from 'vitest';

import { job } from '../job.specification.js';

// Jobs run in-process by definition (CONVENTIONS A8) — specification.job()
// Has no mode: the same runner works regardless of TEST_MODE.

describe('unknown-job', () => {
    test('trigger rejects unknown job names', async () => {
        // Given - a job name that was never registered
        // Then - the error lists every available job, in registration order
        await expect(job.trigger('nope')).rejects.toThrow(
            'trigger("nope"): job not found. Available: sync-events, crash-after-insert, enrich-from-api, stamp-now',
        );
    });
});
