import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

// Import via the package entry point — it wires the integration registry
// (container runtimes + service factories) the Orchestrator consumes.
import { Orchestrator, postgres } from '../../../src/index.js';

const FIXTURES_DIR = resolve(import.meta.dirname, '../../fixtures/app');

describe('orchestrator', () => {
    describe('integration mode', () => {
        const db = postgres();
        const orchestrator = new Orchestrator({
            services: { db },
            mode: 'integration',
            root: FIXTURES_DIR,
        });

        beforeAll(async () => {
            // Given - an orchestrator declaring a postgres service, started once
            await orchestrator.start();
        }, 30_000);

        afterAll(async () => {
            await orchestrator.stop();
        });

        test('starts services with a postgresql connection string', () => {
            // Given - the started orchestrator (image resolved from the compose file)
            // Then - the service is up and its connection string is well-formed
            expect(db.started).toBe(true);
            expect(db.connectionString).toMatch(/^postgresql:\/\//);
        });

        test('getDatabase returns the database handle', () => {
            // Given - a services record containing one database
            // Then - the orchestrator exposes it as the default database
            expect(orchestrator.getDatabase()).not.toBeNull();
        });

        test('database is functional after start', async () => {
            // Given - create and populate a test table
            await db.seed('CREATE TABLE IF NOT EXISTS "test_orch" (id SERIAL, val TEXT)');
            await db.seed('INSERT INTO "test_orch" (val) VALUES (\'hello\')');

            // Then - data is queryable
            expect(await db.query('test_orch', ['val'])).toEqual([['hello']]);

            // Cleanup
            await db.seed('DROP TABLE "test_orch"');
        });
    });

    describe('e2e mode', () => {
        const orchestrator = new Orchestrator({
            services: {},
            mode: 'e2e',
            root: FIXTURES_DIR,
        });

        afterAll(async () => {
            await orchestrator.stopCompose();
        });

        test('starts full compose stack', async () => {
            // Given - clean state
            try {
                await orchestrator.stopCompose();
            } catch {
                /* Ignore */
            }

            // When - start compose
            await orchestrator.startCompose();

            // Then - app URL detected from compose ports
            expect(orchestrator.getAppUrl()).toMatch(/^http:\/\/localhost:\d+/);
        }, 60_000);

        test('auto-detects database service', () => {
            // Given - the compose stack started with no declared services
            // Then - the postgres service was detected from the compose file
            expect(orchestrator.getDatabase()).not.toBeNull();
        });

        // oxlint-disable-next-line jterrazz/d15w-status-only-probe -- reachability probe on a raw fetch Response (no framework result to pin): this asserts the compose-detected URL answers, not any response shape.
        test('app is reachable via detected URL', async () => {
            // Given - app started via compose
            const url = orchestrator.getAppUrl()!;

            // Then - responds to HTTP
            const response = await fetch(`${url}/users`);
            expect(response.status).toBe(200);
        });

        test('database is functional via compose', async () => {
            // Given - seed data through the compose postgres
            const database = orchestrator.getDatabase()!;
            await database.reset();
            await database.seed(
                "INSERT INTO \"users\" (name, email) VALUES ('TestUser', 'test@orch.com')",
            );

            // Then - data is queryable
            expect(await database.query('users', ['name'])).toEqual([['TestUser']]);
        });
    });

    describe('error handling', () => {
        test('throws when compose file not found in e2e mode', async () => {
            // Given - nonexistent project root
            const orch = new Orchestrator({
                services: {},
                mode: 'e2e',
                root: '/tmp/nonexistent',
            });

            // Then - clear error message
            await expect(orch.startCompose()).rejects.toThrow('no compose file found');
        });
    });
});
