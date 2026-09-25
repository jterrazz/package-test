import { describe, expect, test } from 'vitest';

import { ServiceContainer } from './service-container.js';
import { fakeRuntime, POSTGRES, servedRun } from './testcontainers.adapter.fixtures.js';

describe('the container a declared service gets', () => {
    test('is the run container when the run serves one', async () => {
        // Given - a run serving containers, and a service container locating it, started then stopped
        const runtime = fakeRuntime();
        const url = await servedRun(runtime);
        const container = new ServiceContainer(POSTGRES, async () => await Promise.resolve(url));
        await container.start();
        const port = container.getMappedPort(5432);
        await container.stop();

        // Then - the run created it, and still holds it
        expect(runtime.created).toStrictEqual([POSTGRES]);
        expect(port).toBe(40_001);
        expect(runtime.stopped).toHaveLength(0);
    });

    test('refuses every read before it started, and has no logs yet', async () => {
        // Given - a service container nothing started
        const container = new ServiceContainer(POSTGRES, async () => {
            await Promise.resolve();
        });

        // Then - an address is refused, and the logs are empty
        expect(() => container.getConnectionString()).toThrow('Container not started');
        await expect(container.getLogs()).resolves.toBe('');
    });
});
