import { describe, expect, test } from 'vitest';

import { fakeRuntime, POSTGRES, servedRun, unreachable } from './run-containers.fixtures.js';
import { RunSetupContainer } from './run-setup-container.adapter.js';

describe('RunSetupContainer', () => {
    test('a container of the project, as a worker holds it — is reached where the run started it, and reads the run container logs', async () => {
        // Given - a worker's container of the project, started
        const url = await servedRun(fakeRuntime());
        const container = new RunSetupContainer(url, POSTGRES);
        await container.start();

        // Then - it answers the project's address and logs
        expect(container.getHost()).toBe('127.0.0.1');
        expect(container.getMappedPort(5432)).toBe(40_001);
        expect(container.getConnectionString()).toBe('127.0.0.1:40001');
        await expect(container.getLogs()).resolves.toBe('logs of 40001');
    });

    test('a container of the project, as a worker holds it — reads only what the run container logged since the moment it names', async () => {
        // Given - a worker's container of the project, asked for its logs since one moment
        const url = await servedRun(fakeRuntime());
        const container = new RunSetupContainer(url, POSTGRES);
        await container.start();

        // Then - the run reads its container from that moment, not the whole shared log
        await expect(container.getLogs(new Date('2026-09-24T10:00:00.125Z'))).resolves.toBe(
            'logs of 40001 since 2026-09-24T10:00:00.125Z',
        );
    });

    test('a container of the project, as a worker holds it — is never stopped by the worker — the run stops it', async () => {
        // Given - a worker's container of the project, started then stopped by the worker
        const runtime = fakeRuntime();
        const url = await servedRun(runtime);
        const container = new RunSetupContainer(url, POSTGRES);
        await container.start();
        await container.stop();

        // Then - the container still runs
        expect(runtime.stopped).toHaveLength(0);
    });

    test('a container of the project, as a worker holds it — refuses a port it does not expose, naming the one it does', async () => {
        // Given - a started postgres of the project
        const url = await servedRun(fakeRuntime());
        const container = new RunSetupContainer(url, POSTGRES);
        await container.start();

        // Then - asking for another port is refused
        expect(() => container.getMappedPort(6379)).toThrow(
            'the container of the run exposes 5432, and 6379 was asked',
        );
    });

    test('a container of the project, as a worker holds it — carries the run refusal as its own start failure', async () => {
        // Given - a run whose runtime is unreachable
        const url = await servedRun(fakeRuntime(), unreachable);

        // Then - the worker's start fails with the project's reason
        await expect(new RunSetupContainer(url, POSTGRES).start()).rejects.toThrow(
            'no Docker daemon answered',
        );
    });

    test('a container of the project, as a worker holds it — refuses every read before it started, and has no logs yet', async () => {
        // Given - a container of the project nothing started
        const container = new RunSetupContainer('http://127.0.0.1:1', POSTGRES);

        // Then - an address is refused, and the logs are empty
        expect(() => container.getHost()).toThrow(
            'a container of the run was read before it started',
        );
        await expect(container.getLogs()).resolves.toBe('');
    });
});
