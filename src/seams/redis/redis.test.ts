import { describe, expect, test } from 'vitest';

import { redis } from './redis.js';

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

    test('defaults to the redis:7 image and takes an override', () => {
        // Given - one handle with no image option and one with an explicit image
        // Then - the default applies, and the override wins
        expect(redis().defaultImage).toBe('redis:7');
        expect(redis({ image: 'redis:7-alpine' }).defaultImage).toBe('redis:7-alpine');
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
});
