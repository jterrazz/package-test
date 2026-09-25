import { describe, expect, test } from 'vitest';

import { redis } from './redis.js';
import type { RedisHandle } from './redis.js';

/** A handle of one service, pointed at a port nothing listens on: acquire takes its index, then fails to flush it. */
function unreachableService(service: string): RedisHandle {
    const handle = redis();
    handle.serviceName = service;
    handle.connectionString = 'redis://localhost:1';
    return handle;
}

/** The index a handle's connection string carries, and the refusal its acquire met, if any. */
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

/*
 * What the handle answers BEFORE it reaches a container: the string it builds,
 * the compose service it binds to, and the refusals a connection never has to
 * exist for. What needs a live redis is a spec — `specs/integration/redis/`.
 */

describe('redis handle', () => {
    test('builds a redis connection string from a host and a port', () => {
        // Given - a handle and a mapped port
        const connectionString = redis().buildConnectionString('127.0.0.1', 6380);

        // Then - the string uses the scheme a redis client expects
        expect(connectionString).toBe('redis://127.0.0.1:6380');
    });

    test('carries no name of its own until the stack assigns the record key', () => {
        // Given - a freshly created handle, before any stack starts it
        // Then - the record key is the only name in play, and it is not known yet
        expect(redis().serviceName).toBeNull();
    });

    test('defaults to the slim redis:7 image pinned by digest, and takes an override', () => {
        // Given - one handle with no image option and one with an explicit image
        // Then - the default is the pinned slim image, and the override wins
        expect(redis().defaultImage).toMatch(/^redis:7-alpine@sha256:[0-9a-f]{64}$/u);
        expect(redis({ image: 'redis:7' }).defaultImage).toBe('redis:7');
    });

    test('is not a database', () => {
        // Given - a cache handle, not a SQL store
        // Then - it exposes no database adapter
        expect(redis().createDatabaseAdapter()).toBeNull();
    });

    test('refuses a healthcheck with no connection string, naming what is missing', async () => {
        // Given - a fresh handle nothing ever wired
        // Then - the refusal says which half is absent
        await expect(redis().healthcheck()).rejects.toThrow(
            'redis: cannot healthcheck — no connection string',
        );
    });

    test('carries the driver reason when a healthcheck cannot connect', async () => {
        // Given - a handle pointed at a port nothing listens on
        const unreachable = redis();
        unreachable.connectionString = 'redis://localhost:1';

        // Then - it rejects, naming the service AND keeping the driver's own reason, which survives as the error's cause
        const failure = await unreachable
            .healthcheck()
            .then(() => null)
            .catch((error: unknown) => (error instanceof Error ? error : null));
        expect(failure?.message).toContain('redis healthcheck failed: ');
        expect(failure?.message).not.toBe('redis healthcheck failed: ');
        expect(failure?.cause).toBeDefined();
    });

    test('cannot flush a container it cannot reach', async () => {
        // Given - a handle pointed at a port nothing listens on
        const unreachable = redis();
        unreachable.connectionString = 'redis://localhost:1';

        // Then - the reset fails rather than reporting a flush that never happened
        await expect(unreachable.reset()).rejects.toThrow();
    });

    test('asks its container for an index for every worker a run can hold', () => {
        // Given - the command a redis container is started with
        // Then - it serves 256 indexes, 0 its own and one per worker
        expect(redis().containerOptions).toStrictEqual({
            command: ['redis-server', '--databases', '256'],
        });
    });

    test('asks for one container whatever service the stack names it', () => {
        // Given - a handle the stack named "queue"
        const queue = redis();
        queue.serviceName = 'queue';

        // Then - its request names no service, so every redis of the run is one container
        expect(queue.containerOptions).toStrictEqual({
            command: ['redis-server', '--databases', '256'],
        });
    });

    test('refuses a worker past its container indexes, naming the way out', async () => {
        // Given - a handle acquired by pool id 64, the first with no index left
        const crowded = redis();
        crowded.connectionString = 'redis://localhost:1';

        // Then - it refuses before it connects, rather than sharing an index
        await expect(crowded.isolation().acquire('64')).rejects.toThrow(
            'redis: worker 64 has no database index for "redis" — a container serves 63 workers; run with fewer (--maxWorkers)',
        );
    });

    test('refuses a fifth redis service in one worker, naming the way out', async () => {
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
            'redis: worker 60 has no database index for "e" — a worker holds 4 redis services at once; declare fewer',
        );
    });

    test('serves pool id 63 its four services, the last index of the container, and worker 0 the band of pool id 1', async () => {
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

    test('keeps a slot while any handle holds it, so another service never lands on a live index', async () => {
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
});
