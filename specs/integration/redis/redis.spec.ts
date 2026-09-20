import { describe, expect, test } from 'vitest';

import { redis } from '../../../src/index.js';
import { integration } from '../redis.specification.js';

/*
 * The redis seam, met the way a consumer meets it: the facet starts the
 * container and the chain calls the handle with the live connection string.
 * A probe that flushes keys binds a FRESH handle to the same container — the
 * runner's own handle has taken a worker database index (rule G2), and a
 * client opened at the default index would be talking to another database.
 */

describe('redis — the handle against a real container', () => {
    test('builds a connection string on the redis scheme', async () => {
        // Given - the service the runner started
        const result = await integration.call(({ cache }) => {
            const url = new URL(cache.connectionString);
            return { protocol: url.protocol };
        });

        // Then - the scheme is the one a redis client expects
        expect(result.value).toMatch('connection-string.json');
    });

    test('passes its healthcheck on a reachable container', async () => {
        // Given - the started service asked whether it answers
        const result = await integration.call(async ({ cache }) => {
            await cache.healthcheck();
        });

        // Then - it resolved, and refused nothing
        await expect(result.error).toBeEmpty();
    });

    // RUNTIME G2 — isolation is per WORKER: the runner's handle holds this
    // Worker's database index, and a client opened at the default index would
    // Be talking to another database entirely.
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
            await writer.disconnect();

            await probe.reset();

            const reader = createClient({ url: probe.connectionString });
            await reader.connect();
            const after = await reader.get('probe-key');
            await reader.disconnect();
            return { after };
        });

        // Then - the key is gone
        expect(result.value).toMatch('flushed.json');
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
            await client.disconnect();

            await probe.reset();

            const after = createClient({ url: probe.connectionString });
            await after.connect();
            await after.set('after', 'value2');
            const written = await after.get('after');
            const flushed = await after.get('before');
            await after.disconnect();
            return { flushed, written };
        });

        // Then - the new key is there and the flushed one is not
        expect(result.value).toMatch('reset-then-write.json');
    });
});
