import { describe, expect, test } from 'vitest';

import { fakeRuntime, POSTGRES, servedRun } from './run-containers.fixtures.js';
import { ServiceContainer } from './service-container.adapter.js';

describe('ServiceContainer', () => {
    test('the container a declared service gets — is the run container when the run serves one', async () => {
        // Given - a run serving containers, and a service container locating it, started then stopped
        const runtime = fakeRuntime();
        const url = await servedRun(runtime);
        const container = new ServiceContainer(POSTGRES, async () => url);
        await container.start();
        const port = container.getMappedPort(5432);
        await container.stop();

        // Then - the run created it, and still holds it
        expect(runtime.created).toStrictEqual([POSTGRES]);
        expect(port).toBe(40_001);
        expect(runtime.stopped).toHaveLength(0);
    });

    test('the container a declared service gets — lets the run container go when stopped, and its address with it', async () => {
        // Given - a service container of the run, started then stopped
        const container = new ServiceContainer(
            POSTGRES,
            async () => await servedRun(fakeRuntime()),
        );
        await container.start();
        await container.stop();

        // Then - the address it held is the run's to keep, no longer this service's
        expect(() => container.getHost()).toThrow(
            'a container of the run was read before it started',
        );
    });

    test('the container a declared service gets — refuses every read before it started, stops as nothing, and has no logs yet', async () => {
        // Given - a service container nothing started, stopped all the same
        const container = new ServiceContainer(POSTGRES, async () => {});
        await container.stop();

        // Then - an address is refused, and the logs are empty
        expect(() => container.getConnectionString()).toThrow(
            'a service container was read before it started',
        );
        await expect(container.getLogs()).resolves.toBe('');
    });
});
