import { describe, expect, test } from 'vitest';

import { job as staticJob, staticRuns } from '../static-jobs.specification.js';

describe('static-array', () => {
    test('accepts a static array of jobs', async () => {
        // Given - a runner declared with a static Job[] (no factory, no services)
        await staticJob.trigger('record-run');

        // Then - the static job executed
        expect(staticRuns).toContain('record-run');
    });
});
