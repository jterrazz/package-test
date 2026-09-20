import { expect, test } from 'vitest';

import { cli } from '../../setup/runner.specification.js';

/** The port the double below stands in for. */
type ClonePort = { clone: (url: string) => Promise<void> };

test('waits for the server', async () => {
    // Given - framework-level synchronisation
    const result = await cli.exec('serve', { waitFor: /listening/ });

    // Then - ready
    expect(result.exitCode).toBe(0);
});

test('lets a slow clone settle late', async () => {
    // Given - a double written as a plain object literal: the timer is the world it stages, not the test waiting
    const port: ClonePort = {
        clone: async () =>
            await new Promise((resolve) => {
                setTimeout(resolve, 5);
            }),
    };
    await port.clone('git@example.com:x.git');
    const result = await cli.exec('status');

    // Then - the run is clean
    expect(result.exitCode).toBe(0);
});
