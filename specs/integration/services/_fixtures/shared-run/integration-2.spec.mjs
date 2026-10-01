import { test } from 'vitest';

import { recordWorker } from './record.mjs';

test('the integration project records its worker and when it ran', async () => {
    await recordWorker('integration-2');
});
