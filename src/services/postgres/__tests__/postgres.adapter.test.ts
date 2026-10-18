import { once } from 'node:events';
import { createServer } from 'node:net';
import { describe, expect, onTestFinished, test } from 'vitest';

import { postgres } from '../postgres.adapter.js';

describe('postgres', () => {
    test('postgres.adapter — postgres handle — connects with the credentials and on the image it is handed, and is its own database', () => {
        // Given - a handle stated by nobody, and one handed credentials and an image
        const silent = postgres();
        const stated = postgres({
            env: { POSTGRES_DB: 'analytics', POSTGRES_PASSWORD: 'secret', POSTGRES_USER: 'app' },
            image: 'postgres:17',
        });

        // Then - each connection string carries the four parts a client needs, the stated image wins, and the database port is the handle
        expect({
            silent: silent.buildConnectionString('127.0.0.1', 54_321),
            stated: {
                connection: stated.buildConnectionString('db.test', 5432),
                database: stated.createDatabaseAdapter() === stated,
                image: stated.defaultImage,
            },
            type: { name: silent.serviceName, port: silent.defaultPort, type: silent.type },
        }).toStrictEqual({
            silent: 'postgresql://test:test@127.0.0.1:54321/test',
            stated: {
                connection: 'postgresql://app:secret@db.test:5432/analytics',
                database: true,
                image: 'postgres:17',
            },
            type: { name: null, port: 5432, type: 'postgres' },
        });
    });

    test("postgres.adapter — postgres handle — a healthcheck before any connection string is the framework's own broken invariant", async () => {
        // Given - a fresh handle nothing ever wired
        // Then - the refusal says which half is absent, and whose bug it is
        await expect(postgres().healthcheck()).rejects.toThrow(
            new Error(
                '@jterrazz/test broke one of its own invariants, a bug of the framework, not of the test: postgres() was healthchecked before it had a connection string',
            ),
        );
    });

    test('postgres.adapter — postgres handle — carries the driver reason when a healthcheck cannot connect', async () => {
        // Given - a handle pointed at a port nothing listens on
        const unreachable = postgres();
        unreachable.connectionString = 'postgresql://test:test@localhost:1/test';

        // Then - it rejects, naming the service AND keeping the driver's own reason, which survives as the error's cause
        const healthcheck = unreachable.healthcheck();
        await expect(healthcheck).rejects.toThrow(
            /^found: postgres\(\) did not answer its healthcheck: \S.*\nwhy: A declared service is handed to the chain once it answers its healthcheck\.\nfix: check the container is running and reachable \(`docker ps`\), and run again\nread: docs\/reference\/services\.md#service-factories$/u,
        );
        await expect(healthcheck).rejects.toHaveProperty('cause.code', 'ECONNREFUSED');
    });

    test('postgres.adapter — postgres handle — healthchecks the server its own string names', async () => {
        // Given - a server that hangs up on whoever connects, and a handle whose string names it
        let connections = 0;
        const server = createServer((socket) => {
            connections += 1;
            socket.destroy();
        });
        server.listen(0, '127.0.0.1');
        await once(server, 'listening');
        onTestFinished(() => {
            server.close();
        });
        const address = server.address();
        const handle = postgres();
        handle.connectionString = `postgresql://test:test@127.0.0.1:${typeof address === 'object' && address !== null ? address.port : 0}/test`;

        // When - it is healthchecked
        const answer = await handle.healthcheck().then(
            () => 'answered',
            () => 'refused',
        );

        // Then - that server was the one asked, and its hang-up refused the check
        expect([connections, answer]).toStrictEqual([1, 'refused']);
    });
});
