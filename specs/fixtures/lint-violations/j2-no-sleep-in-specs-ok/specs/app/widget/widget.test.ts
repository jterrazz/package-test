import { expect, test } from 'vitest';

import { cli } from '../../setup/runner.specification.js';

test('waits for the server', async () => {
    // Given - framework-level synchronisation
    const result = await cli.exec('serve', { waitFor: /listening/ });

    // Then - ready
    expect(result.exitCode).toBe(0);
});
