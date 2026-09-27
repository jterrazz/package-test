import { describe, expect, test } from 'vitest';

import { postgres } from './postgres.adapter.js';

describe('postgres', () => {
    test('postgres.adapter — postgres handle — builds a postgresql connection string from a host and a port', () => {
        // Given - the default credentials and database name
        const connectionString = postgres().buildConnectionString('127.0.0.1', 54_321);

        // Then - the string carries all four parts a client needs
        expect(connectionString).toBe('postgresql://test:test@127.0.0.1:54321/test');
    });

    test('postgres.adapter — postgres handle — reads its credentials off the env override', () => {
        // Given - a handle told which user, password and database to use
        const handle = postgres({
            env: { POSTGRES_DB: 'analytics', POSTGRES_PASSWORD: 'secret', POSTGRES_USER: 'app' },
        });

        // Then - they are the ones the connection string carries
        expect(handle.buildConnectionString('db.test', 5432)).toBe(
            'postgresql://app:secret@db.test:5432/analytics',
        );
    });

    test('postgres.adapter — postgres handle — defaults to the slim postgres:17 image pinned by digest, and takes an override', () => {
        // Given - one handle with no image option and one with an explicit image
        // Then - the default is the pinned slim image, and the override wins
        expect(postgres().defaultImage).toMatch(/^postgres:17-alpine@sha256:[0-9a-f]{64}$/u);
        expect(postgres({ image: 'postgres:17' }).defaultImage).toBe('postgres:17');
    });

    test('postgres.adapter — postgres handle — is its own database adapter', () => {
        // Given - a postgres handle
        const handle = postgres();

        // Then - the database port it exposes is itself
        expect(handle.createDatabaseAdapter()).toBe(handle);
    });

    test('postgres.adapter — postgres handle — refuses a healthcheck with no connection string, naming what is missing', async () => {
        // Given - a fresh handle nothing ever wired
        // Then - the refusal says which half is absent
        await expect(postgres().healthcheck()).rejects.toThrow(
            'postgres() was healthchecked before it had a connection string',
        );
    });

    test('postgres.adapter — postgres handle — carries the driver reason when a healthcheck cannot connect', async () => {
        // Given - a handle pointed at a port nothing listens on
        const unreachable = postgres();
        unreachable.connectionString = 'postgresql://test:test@localhost:1/test';

        // Then - it rejects, naming the service AND keeping the driver's own reason, which survives as the error's cause
        const failure = await unreachable
            .healthcheck()
            .then(() => null)
            .catch((error: unknown) => (error instanceof Error ? error : null));
        expect(failure?.message).toMatch(
            /^found: postgres\(\) did not answer its healthcheck: \S/u,
        );
        expect(failure?.cause).toBeDefined();
    });
});
