import { expect, test } from 'vitest';

import { job } from '../../setup/job.specification.js';

test('runs the nightly report', async () => {
    // Given - the job pipeline
    const result = await job.trigger('nightly-report');

    // Then - it completes
    expect(result.exitCode).toBe(0);
});
