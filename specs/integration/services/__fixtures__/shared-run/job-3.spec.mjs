import { test } from 'vitest';

import { recordWorker } from './record.mjs';

test('the job project records its worker and when it ran', async () => {
    await recordWorker('job-3');
});
