import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

// The package entry wires the integration registry (container runtimes +
// Service factories) the Orchestrator consumes — and it is the public entry a
// Spec reaches the framework through (rule F3).
import { Orchestrator, postgres, required } from '../../../src/index.js';
import { integration } from '../pure.specification.js';

const FIXTURES_DIR = resolve(import.meta.dirname, '../../_fixtures/app');

/*
 * The orchestrator is the seam every facet stands on: it reads the compose
 * file, starts what a record declares, and hands back the database. The
 * subject starts its own infrastructure, so the runner declares none — what
 * the facet gives this spec is the one terminal action a module has.
 */

describe('orchestrator', () => {
    describe('integration mode', () => {
        const db = postgres();
        const orchestrator = new Orchestrator({
            mode: 'integration',
            root: FIXTURES_DIR,
            services: { db },
        });

        beforeAll(async () => {
            // Given - an orchestrator declaring a postgres service, started once
            await orchestrator.start();
        }, 30_000);

        afterAll(async () => {
            await orchestrator.stop();
        });

        test('starts the declared service with a live connection string', async () => {
            // Given - the started orchestrator (image resolved from the compose file)
            const result = await integration.call(() => {
                const url = new URL(db.connectionString);
                return { protocol: url.protocol, started: db.started };
            });

            // Then - the service is up and its connection string is well-formed
            expect(result.value).toMatch('started.json');
        });

        test('exposes the declared database as the default one', async () => {
            // Given - a services record containing one database
            const result = await integration.call(() => orchestrator.getDatabase() !== null);

            // Then - the orchestrator hands it back
            expect(result.value.value).toBe(true);
        });

        test('hands back a database that is functional after start', async () => {
            // Given - a table created and filled through the started handle
            const result = await integration.call(async () => {
                await db.seed('CREATE TABLE IF NOT EXISTS "test_orch" (id SERIAL, val TEXT)');
                await db.seed('INSERT INTO "test_orch" (val) VALUES (\'hello\')');
                const rows = await db.query('test_orch', ['val']);
                await db.seed('DROP TABLE "test_orch"');
                return rows;
            });

            // Then - the data is queryable through the real connection
            expect(result.value).toMatch('hello.json');
        });
    });

    describe('e2e mode', () => {
        const orchestrator = new Orchestrator({
            mode: 'e2e',
            root: FIXTURES_DIR,
            services: {},
        });

        afterAll(async () => {
            await orchestrator.stopCompose();
        });

        test('brings the whole compose stack up and reads the app URL off it', async () => {
            // Given - no stale stack under the same project name
            const result = await integration.call(async () => {
                try {
                    await orchestrator.stopCompose();
                } catch {
                    /* Ignore */
                }
                await orchestrator.startCompose();
                const url = new URL(
                    required(orchestrator.getAppUrl(), 'the compose stack exposes an app URL'),
                );
                return { hostname: url.hostname, protocol: url.protocol };
            });

            // Then - the app URL is detected from the compose ports
            expect(result.value).toMatch('app-url.json');
        }, 60_000);

        test('detects the database service the compose file declares', async () => {
            // Given - the stack started with no declared services
            const result = await integration.call(() => orchestrator.getDatabase() !== null);

            // Then - the postgres service was found in the compose file
            expect(result.value.value).toBe(true);
        });

        test('answers on the URL it detected', async () => {
            // Given - the app served by the compose stack
            const result = await integration.call(async () => {
                const base = required(
                    orchestrator.getAppUrl(),
                    'the compose stack exposes an app URL',
                );
                const response = await fetch(`${base}/users`);
                return { status: response.status };
            });

            // Then - the detected URL is the one the app listens on
            expect(result.value).toMatch('reachable.json');
        });

        test('hands back the database the compose stack runs', async () => {
            // Given - a row seeded through the compose postgres
            const result = await integration.call(async () => {
                const database = required(
                    orchestrator.getDatabase(),
                    'the compose file declares a database service',
                );
                await database.reset();
                await database.seed(
                    "INSERT INTO \"users\" (name, email) VALUES ('TestUser', 'test@orch.com')",
                );
                return await database.query('users', ['name']);
            });

            // Then - the data is queryable
            expect(result.value).toMatch('compose-user.json');
        });
    });

    describe('what it refuses', () => {
        test('e2e mode without a compose file says so', async () => {
            // Given - a project root holding no compose file
            const result = await integration.call(async () => {
                const orphan = new Orchestrator({
                    mode: 'e2e',
                    root: '/tmp/nonexistent',
                    services: {},
                });
                await orphan.startCompose();
            });

            // Then - the refusal names what is missing
            expect(result.error).toMatch('no-compose-file.txt');
        });
    });
});
