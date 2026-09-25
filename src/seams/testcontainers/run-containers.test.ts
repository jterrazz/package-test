import { describe, expect, test } from 'vitest';

import { RunContainers } from './run-containers.js';
import {
    fakeRuntime,
    POSTGRES,
    POSTGRES_REORDERED,
    REDIS,
    unreachable,
} from './testcontainers.fixtures.js';

describe('the run containers', () => {
    test('answer two requests alike with one container, started once', async () => {
        // Given - two requests for the same container, asked at the same time
        const runtime = fakeRuntime();
        const run = new RunContainers(runtime.create);
        const [first, second] = await Promise.all([
            run.acquire(POSTGRES),
            run.acquire(POSTGRES_REORDERED),
        ]);

        // Then - one container was created, and both are sent to it
        expect(runtime.created).toHaveLength(1);
        expect(second).toStrictEqual(first);
        expect(first.port).toBe(40_001);
    });

    test('start a container of its own for each request that differs', async () => {
        // Given - a postgres and a redis
        const runtime = fakeRuntime();
        const run = new RunContainers(runtime.create);
        const postgres = await run.acquire(POSTGRES);
        const redis = await run.acquire(REDIS);

        // Then - each has its own
        expect([postgres.port, redis.port]).toStrictEqual([40_001, 40_002]);
    });

    test('answer every request with the runtime refusal, and create nothing', async () => {
        // Given - a runtime that never became reachable
        const runtime = fakeRuntime();
        const run = new RunContainers(runtime.create, unreachable);

        // Then - the request is refused with the runtime's reason, and no container exists
        await expect(run.acquire(POSTGRES)).rejects.toThrow('no Docker daemon answered');
        expect(runtime.created).toHaveLength(0);
    });

    test('keep no container whose start failed — the next request starts one again', async () => {
        // Given - a runtime whose first start fails
        const runtime = fakeRuntime({ failFirstStart: true });
        const run = new RunContainers(runtime.create);
        await expect(run.acquire(POSTGRES)).rejects.toThrow('the image could not be pulled');

        // When - the same container is asked for again
        const address = await run.acquire(POSTGRES);

        // Then - a second container was created, and it answers
        expect(runtime.created).toHaveLength(2);
        expect(address.port).toBe(40_002);
    });

    test('stop every container the run started', async () => {
        // Given - two containers of the project
        const runtime = fakeRuntime();
        const run = new RunContainers(runtime.create);
        await run.acquire(POSTGRES);
        await run.acquire(REDIS);

        // When - the run ends
        await run.stop();

        // Then - both were stopped
        expect(runtime.stopped.toSorted((a, b) => a - b)).toStrictEqual([40_001, 40_002]);
    });
});
