import { describe, expect, test } from 'vitest';

import { jobs as staticJobs, staticRuns } from '../static-jobs.specification.js';

// Jobs run in-process by definition (CONVENTIONS A8) — specification.jobs()
// Has no mode: the same runner works regardless of TEST_MODE.

describe('triggering', () => {
    test('accepts a static array of jobs', async () => {
        // Given - a runner declared with a static JobHandle[] (no factory, no services)
        await staticJobs.trigger('record-run');

        // Then - the static job executed
        expect(staticRuns).toContain('record-run');
    });
});
