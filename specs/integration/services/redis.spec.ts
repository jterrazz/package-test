import { describe, expect, inject, test } from 'vitest';

import { redis } from '../../../src/index.js';
import { integration } from '../redis.specification.js';

/* A probe flushing keys binds a fresh handle: the runner's handle holds a worker index (`state-isolated-per-worker`), and index 0 is the container's own, which no reset flushes. */

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

    // RUNTIME state-isolated-per-worker — isolation is per (worker, service) pair: the runner's handle holds this pair's database index, and the default index is the container's own.
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

    // RUNTIME state-isolated-per-worker — two redis services of one worker are two indexes of one container.
    test('two redis services keep their own keys, whatever the other one resets', async () => {
        // Given - a key written through each service, then the second one reset
        const result = await integration.call(async ({ cache, queue }) => {
            const { createClient } = await import('redis');
            const writer = createClient({ url: cache.connectionString });
            await writer.connect();
            await writer.set('shared-name', 'cache-value');
            await writer.quit();
            const other = createClient({ url: queue.connectionString });
            await other.connect();
            const crossed = await other.get('shared-name');
            await other.quit();

            await queue.reset();

            const reader = createClient({ url: cache.connectionString });
            await reader.connect();
            const kept = await reader.get('shared-name');
            await reader.quit();
            return { crossed, kept };
        });

        // Then - neither saw the other's key, and the first service's key outlived the second's reset
        expect(result.value).toMatch({
            crossed: null,
            kept: 'cache-value',
        });
    });

    // RUNTIME state-isolated-per-worker — the project starts ONE redis container: two services are two indexes, not two containers.
    test('two redis services are served by the one container the project started', async () => {
        // Given - each service's address, and the project's answer to a redis request
        const result = await integration.call(async ({ cache, queue }) => {
            const run = inject('serviceContainers');
            const asked = await fetch(`${run}/containers`, {
                body: JSON.stringify({
                    env: { ...cache.environment },
                    image: cache.defaultImage,
                    port: cache.defaultPort,
                    ...queue.containerOptions,
                }),
                method: 'POST',
            });
            const address: unknown = JSON.parse(await asked.text());
            const first = new URL(cache.connectionString);
            const second = new URL(queue.connectionString);
            const runPort =
                typeof address === 'object' && address !== null && 'port' in address
                    ? String(address.port)
                    : null;
            return {
                indexes: first.pathname !== second.pathname,
                sameContainer: first.port === second.port && first.port === runPort,
            };
        });

        // Then - one container, and each service on an index of its own
        expect(result.value).toMatch({
            indexes: true,
            sameContainer: true,
        });
    });

    // RUNTIME state-isolated-per-worker — each worker takes its own database index, and the string the app is handed says which.
    test('two workers take two database indexes, and the connection string carries each', async () => {
        // Given - two "cache" handles on the runner's container, acquired by workers 40 and 41
        const result = await integration.call(async ({ cache }) => {
            const container = new URL(cache.connectionString);
            container.pathname = '';
            const [first, second] = [redis(), redis()];
            await Promise.all(
                [first, second].map(async (handle, worker) => {
                    handle.serviceName = 'cache';
                    handle.connectionString = container.toString().replace(/\/$/u, '');
                    handle.started = true;
                    await handle.isolation().acquire(String(worker + 40));
                }),
            );
            const indexes = [first, second].map(
                (handle) => new URL(handle.connectionString).pathname,
            );
            await first.isolation().release();
            await second.isolation().release();
            return indexes;
        });

        // Then - index 0 stays the container's own, and pool id w's band of four starts at 4w − 3
        expect(result.value).toMatch(['/157', '/161']);
    });

    // RUNTIME state-isolated-per-worker — a pool id is a worker at any --maxWorkers, not modulo a count of indexes.
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

    // RUNTIME state-isolated-per-worker — the project's container outlives a file, and a file that died before its release left its keys at its index.
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

    // RUNTIME state-isolated-per-worker — two workers on one container never share a key.
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
