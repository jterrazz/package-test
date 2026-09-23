import { expect, test } from 'vitest';

import { jobs } from '../../setup/jobs.specification.js';

test('runs the nightly report', async () => {
    // Given - the job pipeline
    const result = await jobs.trigger('nightly-report');

    // Then - it completes
    expect(result.exitCode).toBe(0);
});
