import { describe, expect, test } from 'vitest';

import {
    fakeRuntime,
    POSTGRES,
    POSTGRES_REORDERED,
    REDIS,
    servedRun,
    unreachable,
} from './run-containers.fixtures.js';
import { field, RunContainers } from './run-containers.js';

describe('RunContainers', () => {
    test('the run containers — answer two requests alike with one container, started once', async () => {
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

    test('the run containers — start a container of its own for each request that differs', async () => {
        // Given - a postgres and a redis
        const runtime = fakeRuntime();
        const run = new RunContainers(runtime.create);
        const postgres = await run.acquire(POSTGRES);
        const redis = await run.acquire(REDIS);

        // Then - each has its own
        expect([postgres.port, redis.port]).toStrictEqual([40_001, 40_002]);
    });

    test('the run containers — answer every request with the runtime refusal, and create nothing', async () => {
        // Given - a runtime that never became reachable
        const runtime = fakeRuntime();
        const run = new RunContainers(runtime.create, unreachable);

        // Then - the request is refused with the runtime's reason, and no container exists
        await expect(run.acquire(POSTGRES)).rejects.toThrow('no Docker daemon answered');
        expect(runtime.created).toHaveLength(0);
    });

    test('the run containers — keep no container whose start failed — the next request starts one again', async () => {
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

    test('the run containers — stop every container the run started', async () => {
        // Given - two containers of the project
        const runtime = fakeRuntime();
        const run = new RunContainers(runtime.create);
        await run.acquire(POSTGRES);
        await run.acquire(REDIS);

        // When - the run ends, then a worker asks again
        await run.stop();
        const again = await run.acquire(POSTGRES);

        // Then - both were stopped, and the next request starts a container of its own
        expect([runtime.stopped.toSorted((a, b) => a - b), again.port]).toStrictEqual([
            [40_001, 40_002],
            40_003,
        ]);
    });

    test('the run containers, served — a worker asks for a container and reads its logs over HTTP; anything else is not found, a request of another shape refused', async () => {
        // Given - the run's containers served to the workers
        const url = await servedRun(fakeRuntime());
        const answer = async (
            path: string,
            init?: RequestInit,
        ): Promise<(null | number | string)[]> => {
            const response = await fetch(`${url}${path}`, init);
            return [response.status, response.headers.get('content-type'), await response.text()];
        };
        const post = async (
            body: unknown,
            path = '/containers',
        ): Promise<(null | number | string)[]> =>
            await answer(path, { body: JSON.stringify(body), method: 'POST' });
        const get = async (path: string): Promise<(null | number | string)[]> => await answer(path);

        // When - a worker acquires a container, then reads its logs, all of them and since a moment
        const acquired = await post(REDIS);
        const address: unknown = JSON.parse(String(acquired[2]));
        const key = String(field(address, 'key'));

        // Then - each answer
        expect([
            acquired,
            await get(`/logs?key=${encodeURIComponent(key)}`),
            await get(`/logs?key=${encodeURIComponent(key)}&since=0`),
            await get('/logs?key=nope'),
            await get('/logs'),
            await get('/containers'),
            await post(REDIS, '/logs'),
            await post({ image: 'redis:7-alpine' }),
            await post({ port: 6379 }),
        ]).toStrictEqual([
            [200, 'application/json', JSON.stringify({ host: '127.0.0.1', key, port: 40_001 })],
            [200, 'text/plain', 'logs of 40001'],
            [200, 'text/plain', 'logs of 40001 since 1970-01-01T00:00:00.000Z'],
            [200, 'text/plain', ''],
            [200, 'text/plain', ''],
            [404, null, ''],
            [404, null, ''],
            [
                500,
                'application/json',
                JSON.stringify({
                    error: '@jterrazz/test broke one of its own invariants — a bug of the framework, not of the test: a worker asked for {"image":"redis:7-alpine"}, no container request',
                }),
            ],
            [
                500,
                'application/json',
                JSON.stringify({
                    error: '@jterrazz/test broke one of its own invariants — a bug of the framework, not of the test: a worker asked for {"port":6379}, no container request',
                }),
            ],
        ]);
    });

    test('field — reads a named entry of an object, and nothing of a value that is none', () => {
        // Given - an object holding the entry, null, and a text
        const values: unknown[] = [{ key: 'k' }, null, 'text'];

        // Then - the entry, and nothing for the others
        expect(values.map((value) => field(value, 'key'))).toStrictEqual([
            'k',
            undefined,
            undefined,
        ]);
    });
});
