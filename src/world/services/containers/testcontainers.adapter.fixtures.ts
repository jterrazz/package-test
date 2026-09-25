import { onTestFinished } from 'vitest';

import type { ContainerPort, ContainerRequest } from './container.port.js';
import { RunContainers, serveContainers } from './run-containers.js';

/** What a fake runtime did: the requests it created a container for, and the containers it stopped. */
export type Runtime = {
    create: (request: ContainerRequest) => ContainerPort;
    created: ContainerRequest[];
    stopped: number[];
};

/** A runtime whose containers start at once on a port of their own, numbered in creation order. */
export function fakeRuntime(options: { failFirstStart?: boolean } = {}): Runtime {
    const created: ContainerRequest[] = [];
    const stopped: number[] = [];
    let failing = options.failFirstStart === true;
    const create = (request: ContainerRequest): ContainerPort => {
        created.push(request);
        const port = 40_000 + created.length;
        return {
            getConnectionString: () => `127.0.0.1:${port}`,
            getHost: () => '127.0.0.1',
            getLogs: async (since?: Date) =>
                await Promise.resolve(
                    since === undefined
                        ? `logs of ${port}`
                        : `logs of ${port} since ${since.toISOString()}`,
                ),
            getMappedPort: () => port,
            start: async () => {
                if (failing) {
                    failing = false;
                    throw new Error('the image could not be pulled');
                }
                await Promise.resolve();
            },
            stop: async () => {
                stopped.push(port);
                await Promise.resolve();
            },
        };
    };
    return { create, created, stopped };
}

export const POSTGRES: ContainerRequest = {
    env: { POSTGRES_DB: 'test', POSTGRES_USER: 'test' },
    image: 'postgres:17-alpine',
    port: 5432,
};

/** The same request as {@link POSTGRES}, its keys spelled in another order. */
export const POSTGRES_REORDERED: ContainerRequest = {
    port: 5432,
    image: 'postgres:17-alpine',
    env: { POSTGRES_USER: 'test', POSTGRES_DB: 'test' },
};

/** A runtime no daemon answers. */
export async function unreachable(): Promise<void> {
    await Promise.resolve();
    throw new Error('no Docker daemon answered');
}

export const REDIS: ContainerRequest = { image: 'redis:7-alpine', port: 6379 };

/** The run's containers over a fake runtime, served on a loopback port for the test's lifetime. */
export async function servedRun(runtime: Runtime, ready?: () => Promise<void>): Promise<string> {
    const served = await serveContainers(new RunContainers(runtime.create, ready));
    onTestFinished(async () => {
        await served.close();
    });
    return served.url;
}
