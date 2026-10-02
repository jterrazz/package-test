import { describe, expect, test } from 'vitest';

import { redis } from './redis.adapter.js';
import type { RedisHandle } from './redis.adapter.js';

function unreachableService(service: string): RedisHandle {
    const handle = redis();
    handle.serviceName = service;
    handle.connectionString = 'redis://localhost:1';
    return handle;
}

async function acquired(
    handle: RedisHandle,
    worker: string,
): Promise<{ index: string; refused: boolean }> {
    const reason = await handle
        .isolation()
        .acquire(worker)
        .then(() => '')
        .catch((error: unknown) => (error instanceof Error ? error.message : String(error)));
    return {
        index: new URL(handle.connectionString).pathname,
        refused: reason.includes('has no database index'),
    };
}

describe('redis', () => {
    test('redis.adapter — redis handle — connects on the image it is handed, asks one container serving an index per worker whatever service it is named, and is no database', () => {
        // Given - a handle stated by nobody, and one handed an image and named by the stack
        const silent = redis();
        const stated = redis({ image: 'redis:7' });
        stated.serviceName = 'queue';

        // Then - the string uses the scheme a client expects, both ask the same 256-index container, and neither exposes a database adapter
        expect({
            silent: {
                connection: silent.buildConnectionString('127.0.0.1', 6380),
                container: silent.containerOptions,
                database: silent.createDatabaseAdapter(),
                name: silent.serviceName,
            },
            stated: { container: stated.containerOptions, image: stated.defaultImage },
        }).toStrictEqual({
            silent: {
                connection: 'redis://127.0.0.1:6380',
                container: { command: ['redis-server', '--databases', '256'] },
                database: null,
                name: null,
            },
            stated: {
                container: { command: ['redis-server', '--databases', '256'] },
                image: 'redis:7',
            },
        });
    });

    test('redis.adapter — redis handle — a healthcheck before any connection string is the framework’s own broken invariant', async () => {
        // Given - a fresh handle nothing ever wired
        // Then - the refusal says which half is absent, and whose bug it is
        await expect(redis().healthcheck()).rejects.toThrow(
            new Error(
                '@jterrazz/test broke one of its own invariants — a bug of the framework, not of the test: redis() was healthchecked before it had a connection string',
            ),
        );
    });

    test('redis.adapter — redis handle — cannot flush a container it cannot reach, and says the connection was refused', async () => {
        // Given - a handle pointed at a port nothing listens on
        const unreachable = redis();
        unreachable.connectionString = 'redis://localhost:1';

        // Then - the reset fails with the refused connection rather than reporting a flush that never happened
        await expect(unreachable.reset()).rejects.toMatchObject({ code: 'ECONNREFUSED' });
    });

    test('redis.adapter — redis handle — carries the driver reason when a healthcheck cannot connect', async () => {
        // Given - a handle pointed at a port nothing listens on
        const unreachable = redis();
        unreachable.connectionString = 'redis://localhost:1';

        // Then - it rejects, naming the service AND keeping the driver's own reason, which survives as the error's cause
        const healthcheck = unreachable.healthcheck();
        await expect(healthcheck).rejects.toThrow(
            /^found: redis\(\) did not answer its healthcheck: \S.*\nwhy: A declared service is handed to the chain once it answers its healthcheck\.\nfix: check the container is running and reachable \(`docker ps`\), and run again\nread: docs\/17-services\.md#service-factories$/u,
        );
        await expect(healthcheck).rejects.toHaveProperty('cause.code', 'ECONNREFUSED');
    });

    test('redis.adapter — redis handle — refuses a worker past its container indexes, naming the way out', async () => {
        // Given - a handle acquired by pool id 64, the first with no index left
        const crowded = redis();
        crowded.connectionString = 'redis://localhost:1';

        // Then - it refuses before it connects, rather than sharing an index
        await expect(crowded.isolation().acquire('64')).rejects.toThrow(
            [
                'found: redis: worker 64 has no database index for "redis"',
                'why: A redis container’s indexes are shared out four per worker, so its workers and their services are counted.',
                'fix: run with fewer workers (--maxWorkers): a container serves 63',
                'read: docs/17-services.md#per-worker-isolation',
            ].join('\n'),
        );
    });

    test('redis.adapter — redis handle — refuses a fifth redis service in one worker, naming the way out', async () => {
        // Given - four services of worker 60 holding their indexes, and a fifth asking
        const held = ['a', 'b', 'c', 'd'].map((name) => {
            const handle = redis();
            handle.serviceName = name;
            return handle;
        });
        const fifth = redis();
        fifth.serviceName = 'e';
        fifth.connectionString = 'redis://localhost:1';
        await Promise.allSettled(
            held.map(async (handle) => {
                handle.connectionString = 'redis://localhost:1';
                await handle.isolation().acquire('60');
            }),
        );

        // Then - it refuses before it connects, rather than sharing a pair's index
        await expect(fifth.isolation().acquire('60')).rejects.toThrow(
            [
                'found: redis: worker 60 has no database index for "e"',
                'why: A redis container’s indexes are shared out four per worker, so its workers and their services are counted.',
                'fix: declare fewer redis services: a worker holds 4 at once',
                'read: docs/17-services.md#per-worker-isolation',
            ].join('\n'),
        );
    });

    test('redis.adapter — redis handle — serves pool id 63 its four services, the last index of the container, and worker 0 the band of pool id 1', async () => {
        // Given - four services of pool id 63, and one of worker 0 and of pool id 1
        const last = await Promise.all(
            ['a', 'b', 'c', 'd'].map(
                async (service) => await acquired(unreachableService(service), '63'),
            ),
        );
        const first = await Promise.all([
            acquired(unreachableService('outside'), '0'),
            acquired(unreachableService('pooled'), '1'),
        ]);

        // Then - pool id 63 holds 249 to 252, nothing refused, and worker 0 shares pool id 1's first index
        expect({ first, last }).toStrictEqual({
            first: [
                { index: '/1', refused: false },
                { index: '/1', refused: false },
            ],
            last: [
                { index: '/249', refused: false },
                { index: '/250', refused: false },
                { index: '/251', refused: false },
                { index: '/252', refused: false },
            ],
        });
    });

    test('redis.adapter — redis handle — keeps a slot while any handle holds it, so another service never lands on a live index', async () => {
        // Given - two handles of worker 50's "cache" and one of its "queue"; the first cache and the queue released
        const [firstCache, queue, secondCache] = [
            unreachableService('cache'),
            unreachableService('queue'),
            unreachableService('cache'),
        ];
        const held = [
            await acquired(firstCache, '50'),
            await acquired(queue, '50'),
            await acquired(secondCache, '50'),
        ];
        await Promise.allSettled([firstCache.isolation().release(), queue.isolation().release()]);

        // When - another queue of worker 50 acquires
        const later = await acquired(unreachableService('queue'), '50');

        // Then - both caches shared the first index, and the later queue took the freed one, not the index the second cache still holds
        expect({ held, later }).toStrictEqual({
            held: [
                { index: '/197', refused: false },
                { index: '/198', refused: false },
                { index: '/197', refused: false },
            ],
            later: { index: '/198', refused: false },
        });
    });

    test('redis.adapter — redis handle — gives its pair back on release even when the flush fails', async () => {
        // Given - worker 40's cache acquired and released against a container nothing answers on, so both flushes fail
        const cache = unreachableService('cache');
        const held = await acquired(cache, '40');
        const release = await cache
            .isolation()
            .release()
            .then(() => 'flushed')
            .catch(() => 'refused');

        // When - worker 40's queue acquires
        const later = await acquired(unreachableService('queue'), '40');

        // Then - the release was refused, and still handed back the index and the container's own string
        expect({ held, later, release, string: cache.connectionString }).toStrictEqual({
            held: { index: '/157', refused: false },
            later: { index: '/157', refused: false },
            release: 'refused',
            string: 'redis://localhost:1',
        });
    });

    test('redis.adapter — redis handle — gives its pair back before it acquires again', async () => {
        // Given - worker 30's cache acquired twice with no release between, then released once
        const cache = unreachableService('cache');
        const first = await acquired(cache, '30');
        const again = await acquired(cache, '30');
        await Promise.allSettled([cache.isolation().release()]);

        // When - worker 30's queue acquires
        const later = await acquired(unreachableService('queue'), '30');

        // Then - one index held once, on the container's own string, and free after the one release
        expect({ again, first, later, string: cache.connectionString }).toStrictEqual({
            again: { index: '/117', refused: false },
            first: { index: '/117', refused: false },
            later: { index: '/117', refused: false },
            string: 'redis://localhost:1',
        });
    });
});
