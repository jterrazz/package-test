import { describe, expect, test } from 'vitest';

import { RunContainer } from './run-container.js';
import { fakeRuntime, POSTGRES, servedRun, unreachable } from './testcontainers.fixtures.js';

describe('a container of the run, as a worker holds it', () => {
    test('is reached where the run started it, and reads the run container logs', async () => {
        // Given - a worker's container of the run, started
        const url = await servedRun(fakeRuntime());
        const container = new RunContainer(url, POSTGRES);
        await container.start();

        // Then - it answers the run's address and logs
        expect(container.getHost()).toBe('127.0.0.1');
        expect(container.getMappedPort(5432)).toBe(40_001);
        expect(container.getConnectionString()).toBe('127.0.0.1:40001');
        await expect(container.getLogs()).resolves.toBe('logs of 40001');
    });

    test('is never stopped by the worker — the run stops it', async () => {
        // Given - a worker's container of the run, started then stopped by the worker
        const runtime = fakeRuntime();
        const url = await servedRun(runtime);
        const container = new RunContainer(url, POSTGRES);
        await container.start();
        await container.stop();

        // Then - the container still runs
        expect(runtime.stopped).toHaveLength(0);
    });

    test('refuses a port it does not expose, naming the one it does', async () => {
        // Given - a started postgres of the run
        const url = await servedRun(fakeRuntime());
        const container = new RunContainer(url, POSTGRES);
        await container.start();

        // Then - asking for another port is refused
        expect(() => container.getMappedPort(6379)).toThrow(
            'Container of the run exposes 5432, not 6379',
        );
    });

    test('carries the run refusal as its own start failure', async () => {
        // Given - a run whose runtime is unreachable
        const url = await servedRun(fakeRuntime(), unreachable);

        // Then - the worker's start fails with the run's reason
        await expect(new RunContainer(url, POSTGRES).start()).rejects.toThrow(
            'no Docker daemon answered',
        );
    });

    test('refuses every read before it started, and has no logs yet', async () => {
        // Given - a container of the run nothing started
        const container = new RunContainer('http://127.0.0.1:1', POSTGRES);

        // Then - an address is refused, and the logs are empty
        expect(() => container.getHost()).toThrow('Container not started');
        await expect(container.getLogs()).resolves.toBe('');
    });
});
