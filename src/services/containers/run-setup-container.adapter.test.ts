import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, expect, onTestFinished, test } from 'vitest';

import { fakeRuntime, POSTGRES, servedRun, unreachable } from './run-containers.fixtures.js';
import { RunSetupContainer } from './run-setup-container.adapter.js';

const startRefusal = (reason: string): string =>
    [
        `found: the run's setup could not start postgres:17-alpine:\n  ${reason}`,
        'why: A container is started once per run, by the run’s setup, and a worker asks it for the address.',
        'fix: fix what the reason names, and run again',
        'read: docs/18-services.md#one-container-per-run',
    ].join('\n');

async function twoLineReason(): Promise<void> {
    throw new Error('the daemon refused\nthe socket is closed');
}

/** A run whose every request is answered with this body. */
async function answering(body: unknown): Promise<string> {
    const server = createServer((_, response) => {
        response.end(JSON.stringify(body));
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    onTestFinished(() => {
        server.close();
    });
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a TCP server listening on a host answers an AddressInfo
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

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

        // Then - the container still runs, and the worker holds no address of it
        expect(runtime.stopped).toHaveLength(0);
        expect(() => container.getHost()).toThrow(
            'a container of the run was read before it started',
        );
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

    test('a container of the project, as a worker holds it — carries the run refusal as its own start failure, each line of it indented', async () => {
        // Given - a run whose runtime is unreachable, and one whose reason runs over two lines
        const unreached = await servedRun(fakeRuntime(), unreachable);
        const twoLines = await servedRun(fakeRuntime(), twoLineReason);

        // Then - the worker's start fails with the project's reason
        await expect(new RunSetupContainer(unreached, POSTGRES).start()).rejects.toThrow(
            new Error(startRefusal('no Docker daemon answered')),
        );
        await expect(new RunSetupContainer(twoLines, POSTGRES).start()).rejects.toThrow(
            new Error(startRefusal('the daemon refused\n  the socket is closed')),
        );
    });

    test.each([
        { answer: { host: 'h', key: 'k' } },
        { answer: { host: 'h', port: 1 } },
        { answer: { key: 'k', port: 1 } },
        { answer: { error: 1, host: 'h', key: 'k', port: '1' } },
    ])(
        'a container of the project, as a worker holds it — refuses an answer that is no address: $answer',
        async ({ answer }) => {
            // Given - a run answering a body short of an address
            const url = await answering(answer);
            const named = `the run answered no container: ${JSON.stringify(answer)}`;

            // Then - the start names what the run answered
            await expect(new RunSetupContainer(url, POSTGRES).start()).rejects.toThrow(
                new Error(startRefusal(named)),
            );
        },
    );

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
