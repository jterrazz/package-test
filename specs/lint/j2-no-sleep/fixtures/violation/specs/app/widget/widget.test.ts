import { expect, test } from 'vitest';

import { cli } from '../../setup/runner.specification.js';

test('waits for the server', async () => {
    // Given - an arbitrary sleep
    await new Promise((resolve) => setTimeout(resolve, 500));
    const result = await cli.exec('status');

    // Then - probably ready
    expect(result.exitCode).toBe(0);
});
