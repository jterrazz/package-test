import { describe, expect, test } from 'vitest';

import { postgres } from './postgres.js';

/*
 * What the handle answers BEFORE it reaches a container: the string it builds,
 * the adapter it is, and the two refusals a connection never has to exist for.
 * Everything that needs a live postgres is a spec — `specs/integration/postgres/`.
 */

describe('postgres handle', () => {
    test('builds a postgresql connection string from a host and a port', () => {
        // Given - the default credentials and database name
        const connectionString = postgres().buildConnectionString('127.0.0.1', 54_321);

        // Then - the string carries all four parts a client needs
        expect(connectionString).toBe('postgresql://test:test@127.0.0.1:54321/test');
    });

    test('reads its credentials off the env override', () => {
        // Given - a handle told which user, password and database to use
        const handle = postgres({
            env: { POSTGRES_DB: 'analytics', POSTGRES_PASSWORD: 'secret', POSTGRES_USER: 'app' },
        });

        // Then - they are the ones the connection string carries
        expect(handle.buildConnectionString('db.test', 5432)).toBe(
            'postgresql://app:secret@db.test:5432/analytics',
        );
    });

    test('is its own database adapter', () => {
        // Given - a postgres handle
        const handle = postgres();

        // Then - the database port it exposes is itself
        expect(handle.createDatabaseAdapter()).toBe(handle);
    });

    test('refuses a healthcheck with no connection string, naming what is missing', async () => {
        // Given - a fresh handle nothing ever wired
        // Then - the refusal says which half is absent
        await expect(postgres().healthcheck()).rejects.toThrow(
            'postgres: cannot healthcheck — no connection string',
        );
    });

    test('carries the driver reason when a healthcheck cannot connect', async () => {
        // Given - a handle pointed at a port nothing listens on
        const unreachable = postgres();
        unreachable.connectionString = 'postgresql://test:test@localhost:1/test';

        // Then - it rejects, naming the service AND keeping the driver's own
        // Reason, which survives as the error's cause
        const failure = await unreachable
            .healthcheck()
            .then(() => null)
            .catch((error: unknown) => (error instanceof Error ? error : null));
        expect(failure?.message).toContain('postgres healthcheck failed: ');
        expect(failure?.message).not.toBe('postgres healthcheck failed: ');
        expect(failure?.cause).toBeDefined();
    });
});
