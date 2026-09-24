import { describe, expect, test } from 'vitest';

import { redis } from '../../../src/index.js';
import { integration } from '../redis.specification.js';

/*
 * The redis seam, met the way a consumer meets it: the facet starts the
 * container and the chain calls the handle with the live connection string.
 * A probe that flushes keys binds a FRESH handle to the same container — the
 * runner's own handle has taken a worker database index (rule G2), and a
 * client opened at the default index reaches the container's own index 0,
 * which no worker uses and no reset flushes.
 */

describe('redis', () => {
    test('builds a connection string on the redis scheme', async () => {
        // Given - the service the runner started
        const result = await integration.call(({ cache }) => {
            const url = new URL(cache.connectionString);
            return { protocol: url.protocol };
        });

        // Then - the scheme is the one a redis client expects
        expect(result.value).toMatch({
            protocol: 'redis:',
        });
    });

    test('passes its healthcheck on a reachable container', async () => {
        // Given - the started service asked whether it answers
        const result = await integration.call(async ({ cache }) => {
            await cache.healthcheck();
        });

        // Then - it resolved, and refused nothing
        expect(result.error.text).toBe('');
    });

    // RUNTIME G2 — isolation is per WORKER: the runner's handle holds this
    // Worker's database index, and the default index is the container's own.
    test('flushes every key on reset', async () => {
        // Given - a key written to the container, then a reset
        const result = await integration.call(async ({ cache }) => {
            const { createClient } = await import('redis');
            const probe = redis();
            probe.connectionString = cache.connectionString;
            probe.started = true;

            const writer = createClient({ url: probe.connectionString });
            await writer.connect();
            await writer.set('probe-key', 'probe-value');
            writer.destroy();

            await probe.reset();

            const reader = createClient({ url: probe.connectionString });
            await reader.connect();
            const after = await reader.get('probe-key');
            reader.destroy();
            return { after };
        });

        // Then - the key is gone
        expect(result.value).toMatch({
            after: null,
        });
    });

    test('takes keys again after a reset', async () => {
        // Given - a key, a reset, then a second key
        const result = await integration.call(async ({ cache }) => {
            const { createClient } = await import('redis');
            const probe = redis();
            probe.connectionString = cache.connectionString;
            probe.started = true;

            const client = createClient({ url: probe.connectionString });
            await client.connect();
            await client.set('before', 'value1');
            client.destroy();

            await probe.reset();

            const after = createClient({ url: probe.connectionString });
            await after.connect();
            await after.set('after', 'value2');
            const written = await after.get('after');
            const flushed = await after.get('before');
            after.destroy();
            return { flushed, written };
        });

        // Then - the new key is there and the flushed one is not
        expect(result.value).toMatch({
            flushed: null,
            written: 'value2',
        });
    });

    // RUNTIME G2 — each worker takes its own database index, and the string the app is handed says which.
    test('two workers take two database indexes, and the connection string carries each', async () => {
        // Given - two handles on the runner's container, acquired by workers 1 and 2
        const result = await integration.call(async ({ cache }) => {
            const container = new URL(cache.connectionString);
            container.pathname = '';
            const [first, second] = [redis(), redis()];
            await Promise.all(
                [first, second].map(async (handle, worker) => {
                    handle.connectionString = container.toString().replace(/\/$/u, '');
                    handle.started = true;
                    await handle.isolation().acquire(String(worker + 1));
                }),
            );
            const indexes = [first, second].map(
                (handle) => new URL(handle.connectionString).pathname,
            );
            await first.isolation().release();
            await second.isolation().release();
            return indexes;
        });

        // Then - index 0 stays the container's own, and neither worker is on the other's
        expect(result.value).toMatch(['/2', '/3']);
    });

    // RUNTIME G2 — a pool id is a worker at any --maxWorkers, not modulo a count of indexes.
    test('workers 1 and 16 take two indexes, and a key one writes the other never reads', async () => {
        // Given - two handles acquired by pool ids 1 and 16, the first writing
        const result = await integration.call(async ({ cache }) => {
            const { createClient } = await import('redis');
            const container = new URL(cache.connectionString);
            container.pathname = '';
            const [first, sixteenth] = [redis(), redis()];
            await Promise.all(
                (
                    [
                        [first, '1'],
                        [sixteenth, '16'],
                    ] as const
                ).map(async ([handle, worker]) => {
                    handle.connectionString = container.toString().replace(/\/$/u, '');
                    handle.started = true;
                    await handle.isolation().acquire(worker);
                }),
            );

            const writer = createClient({ url: first.connectionString });
            await writer.connect();
            await writer.set('worker-key', 'first');
            await writer.quit();
            const reader = createClient({ url: sixteenth.connectionString });
            await reader.connect();
            const seen = await reader.get('worker-key');
            await reader.quit();

            await first.isolation().release();
            await sixteenth.isolation().release();
            return { seen };
        });

        // Then - the sixteenth worker saw nothing of the first's
        expect(result.value).toMatch({
            seen: null,
        });
    });

    // RUNTIME G2 — the run's container outlives a file, and a file that died
    // Before its release left its keys at its index.
    test('a worker acquires its index empty, whatever a worker before it left there', async () => {
        // Given - one handle that writes at its index and never releases, then another acquired by the same worker
        const result = await integration.call(async ({ cache }) => {
            const { createClient } = await import('redis');
            const container = new URL(cache.connectionString);
            container.pathname = '';
            const bare = container.toString().replace(/\/$/u, '');
            const [died, next] = [redis(), redis()];

            died.connectionString = bare;
            died.started = true;
            await died.isolation().acquire('9');
            const writer = createClient({ url: died.connectionString });
            await writer.connect();
            await writer.set('leftover', 'from-the-file-that-died');
            await writer.quit();

            next.connectionString = bare;
            next.started = true;
            await next.isolation().acquire('9');
            const reader = createClient({ url: next.connectionString });
            await reader.connect();
            const seen = await reader.get('leftover');
            await reader.quit();
            await next.isolation().release();
            return { seen };
        });

        // Then - the second worker starts on nothing
        expect(result.value).toMatch({
            seen: null,
        });
    });

    // RUNTIME G2 — two workers on one container never share a key.
    test('two workers take two database indexes, and a key one writes the other never reads', async () => {
        // Given - two handles on the runner's container, acquired by two workers, one of them writing
        const result = await integration.call(async ({ cache }) => {
            const { createClient } = await import('redis');
            const container = new URL(cache.connectionString);
            container.pathname = '';
            const [first, second] = [redis(), redis()];
            await Promise.all(
                [first, second].map(async (handle, index) => {
                    handle.connectionString = container.toString().replace(/\/$/u, '');
                    handle.started = true;
                    await handle.isolation().acquire(String(7 + index));
                }),
            );

            const writer = createClient({ url: first.connectionString });
            await writer.connect();
            await writer.set('worker-key', 'first');
            await writer.quit();
            const reader = createClient({ url: second.connectionString });
            await reader.connect();
            const seen = await reader.get('worker-key');
            await reader.quit();

            await first.isolation().release();
            await second.isolation().release();
            return { first: new URL(first.connectionString).pathname, seen };
        });

        // Then - the second worker saw nothing, and release gave the first its container's string back
        expect(result.value).toMatch({
            first: '',
            seen: null,
        });
    });
});
