import { resolve } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';

import { postgres } from '../../../src/adapters/postgres.adapter.js';
import { Orchestrator } from '../../../src/infra/orchestrator.js';

const FIXTURES_DIR = resolve(import.meta.dirname, '../../setup/fixtures/app');

describe('orchestrator', () => {
    describe('integration mode', () => {
        const db = postgres({ compose: 'db' });
        const orchestrator = new Orchestrator({
            services: [db],
            mode: 'integration',
            root: FIXTURES_DIR,
        });

        afterAll(async () => {
            await orchestrator.stop();
        });

        test('starts services via testcontainers', async () => {
            // When - orchestrator starts with a postgres service
            await orchestrator.start();

            // Then - service is started with connection string
            expect(db.started).toBe(true);
            expect(db.connectionString).toMatch(/^postgresql:\/\//);
        }, 30_000);

        test('reads image from compose file', () => {
            // Then - connection string populated (image resolved from compose)
            expect(db.connectionString).toBeTruthy();
        });

        test('populates connection string from running container', () => {
            expect(db.connectionString).toContain('test');
        });

        test('getDatabase returns the database handle', () => {
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
            services: [],
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
            expect(orchestrator.getDatabase()).not.toBeNull();
        });

        test('auto-detects app URL', () => {
            expect(orchestrator.getAppUrl()).toBeTruthy();
        });

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
                services: [],
                mode: 'e2e',
                root: '/tmp/nonexistent',
            });

            // Then - clear error message
            await expect(orch.startCompose()).rejects.toThrow('no compose file found');
        });
    });
});
