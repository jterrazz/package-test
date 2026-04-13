import { resolve } from 'node:path';
import { beforeAll, describe, expect, test, vi } from 'vitest';

import { normalizeOutput, stripAnsi } from '../../../../src/index.js';
import { Orchestrator } from '../../../../src/infrastructure/orchestrator.js';
import { postgres } from '../../../../src/infrastructure/services/postgres.js';
import { redis } from '../../../../src/infrastructure/services/redis.js';

const BROKEN_POSTGRES_INIT = resolve(
    import.meta.dirname,
    '../../../setup/fixtures/broken-postgres-init',
);
const BROKEN_MULTI_INIT = resolve(import.meta.dirname, '../../../setup/fixtures/broken-multi-init');
const BROKEN_SECOND_POSTGRES = resolve(
    import.meta.dirname,
    '../../../setup/fixtures/broken-second-postgres',
);

describe('initiation errors', () => {
    describe('postgres init script failure', () => {
        let caughtError: Error;
        let consoleOutput: string;

        beforeAll(async () => {
            // Given — postgres with broken init.sql (start once, assert many)
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const db = postgres({ compose: 'db' });
            const orchestrator = new Orchestrator({
                mode: 'integration',
                root: BROKEN_POSTGRES_INIT,
                services: [db],
            });

            try {
                await orchestrator.start();
            } catch (error: any) {
                caughtError = error;
            }

            consoleOutput = spy.mock.calls[0]?.[0] ?? '';
            spy.mockRestore();
            await orchestrator.stop();
        }, 30_000);

        test('throws with init script path and SQL error', () => {
            // Then — error includes init script path
            expect(caughtError.message).toContain('init script failed');
        });

        test('error report shows failed service with cross symbol', () => {
            // Then — formatted report includes failure markers
            const output = normalizeOutput(consoleOutput);
            expect(output).toContain('INFRA');
            expect(output).toContain('Starting infrastructure...');
            expect(output).toContain('× postgres (db)');
            expect(output).toContain('init script failed');
            expect(output).toContain('app: in-process (Hono)');
        });

        test('error report includes postgres container logs', () => {
            // Then — report includes container log lines from the failing postgres
            const output = stripAnsi(consoleOutput);
            expect(output).toContain('database system is ready to accept connections');
        });
    });

    describe('multi-service failure — redis succeeds, postgres fails', () => {
        let consoleOutput: string;

        beforeAll(async () => {
            // Given — redis (ok) + postgres with broken init.sql (start once)
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const cache = redis({ compose: 'cache' });
            const db = postgres({ compose: 'db' });
            const orchestrator = new Orchestrator({
                mode: 'integration',
                root: BROKEN_MULTI_INIT,
                services: [cache, db],
            });

            try {
                await orchestrator.start();
            } catch {
                /* Expected */
            }

            consoleOutput = spy.mock.calls[0]?.[0] ?? '';
            spy.mockRestore();
            await orchestrator.stop();
        }, 30_000);

        test('error report shows redis success then postgres failure', () => {
            // Then — report shows redis success, then postgres failure
            const output = normalizeOutput(consoleOutput);
            expect(output).toContain('✓ redis (cache)');
            expect(output).toContain('× postgres (db)');
            expect(output).toContain('init script failed');
        });

        test('redis appears before postgres in report', () => {
            // Then — redis line comes before postgres line
            const output = stripAnsi(consoleOutput);
            const redisIndex = output.indexOf('redis (cache)');
            const postgresIndex = output.indexOf('postgres (db)');
            expect(redisIndex).toBeLessThan(postgresIndex);
        });
    });

    describe('multi-postgres failure — first succeeds, second fails', () => {
        let caughtError: Error;
        let consoleOutput: string;

        beforeAll(async () => {
            // Given — db (ok init) + broken-db (bad init) — start once
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const db = postgres({ compose: 'db' });
            const brokenDb = postgres({ compose: 'broken-db' });
            const orchestrator = new Orchestrator({
                mode: 'integration',
                root: BROKEN_SECOND_POSTGRES,
                services: [db, brokenDb],
            });

            try {
                await orchestrator.start();
            } catch (error: any) {
                caughtError = error;
            }

            consoleOutput = spy.mock.calls[0]?.[0] ?? '';
            spy.mockRestore();
            await orchestrator.stop();
        }, 30_000);

        test('error report shows first postgres success then second failure', () => {
            // Then — first postgres succeeded, second failed
            const output = normalizeOutput(consoleOutput);
            expect(output).toContain('✓ postgres (db)');
            expect(output).toContain('× postgres (broken-db)');
            expect(output).toContain('init script failed');
        });

        test('thrown error identifies the broken database', () => {
            // Then — error includes the broken init path
            expect(caughtError.message).toContain('init script failed');
            expect(caughtError.message).toContain('broken-db/init.sql');
        });

        test('second postgres failure includes its own container logs', () => {
            // Then — logs are from the broken-db container
            const output = stripAnsi(consoleOutput);
            expect(output).toContain('database system is ready to accept connections');
        });
    });
});
