/* oxlint-disable jterrazz/a1-specification-file -- negative constructor specs:
   every specification.api() call here MUST fail to start, so no runner can
   live in a *.specification.ts file (A1's sanctioned home is for runners that
   boot). The failure paths themselves are the behaviour under test. */
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, test, vi } from 'vitest';

// Import via the package entry point — it wires the integration registry
// (container runtimes + service factories) the Orchestrator consumes.
import { Orchestrator, postgres, redis, specification } from '../../../src/index.js';

// eslint-disable-next-line no-control-regex
const stripAnsi = (text: string): string => text.replace(/\x1b\[[0-9;]*m/g, '');

const BROKEN_POSTGRES_INIT = resolve(import.meta.dirname, '../../fixtures/broken-postgres-init');
const BROKEN_MULTI_INIT = resolve(import.meta.dirname, '../../fixtures/broken-multi-init');
const BROKEN_SECOND_POSTGRES = resolve(
    import.meta.dirname,
    '../../fixtures/broken-second-postgres',
);
const BROKEN_COMPOSE = resolve(import.meta.dirname, '../../fixtures/broken-compose');

/*
 * Scalpel by design: the captured console report interleaves the orchestrator's own
 * service-status lines with live postgres container logs and absolute init-script
 * paths — a full snapshot is unstable by nature (third-party logs, timing, paths).
 * Each test probes the status markers / error text that prove the failure behaviour;
 * caughtError.message assertions probe the thrown Error, not a stream.
 */

describe('initiation errors', () => {
    describe('constructor validation', () => {
        test('rejects an invalid TEST_MODE value naming both accepted modes', async () => {
            // Given - a TEST_MODE value outside node|compose
            process.env.TEST_MODE = 'bogus';
            try {
                // Then - specification.api() refuses to start with the exact vocabulary
                await expect(specification.api({})).rejects.toThrow(
                    `Invalid test mode "bogus" — expected 'node' or 'compose' (options.mode or TEST_MODE).`,
                );
            } finally {
                delete process.env.TEST_MODE;
            }
        });

        test('node mode without a server explains what is missing', async () => {
            // Given - node mode (the default) and no server factory
            // Then - the error names the option and the compose alternative
            await expect(specification.api({})).rejects.toThrow(
                "specification.api(): 'server' is required in node mode",
            );
        });
    });

    describe('compose without an app service', () => {
        const composeDown = (): void => {
            const project = `test-worker-${process.env.VITEST_POOL_ID ?? '0'}`;
            try {
                execSync(
                    `docker compose -p ${project} -f ${BROKEN_COMPOSE}/docker/compose.test.yaml down -v --remove-orphans`,
                    { stdio: 'ignore', timeout: 60_000 },
                );
            } catch {
                /* Best-effort teardown */
            }
        };

        test('fails app-URL detection with a clear error', async () => {
            // Given - a compose file with only infra services (no service has build:)
            // (pre-clean any stale stack under the same project name)
            composeDown();
            try {
                // Then - compose mode cannot locate the app and says so
                await expect(
                    specification.api({ mode: 'compose', root: BROKEN_COMPOSE }),
                ).rejects.toThrow(
                    'specification.api(): could not detect app URL from compose. ' +
                        'Ensure an app service with ports is defined.',
                );
            } finally {
                // The constructor threw before handing back a cleanup — tear the
                // Stack down by project name (same naming as the runner).
                composeDown();
            }
        }, 120_000);
    });

    describe('postgres init script failure', () => {
        let caughtError: Error;
        let consoleOutput: string;

        beforeAll(async () => {
            // Given - postgres with broken init.sql (start once, assert many)
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const db = postgres({ composeService: 'db' });
            const orchestrator = new Orchestrator({
                mode: 'integration',
                root: BROKEN_POSTGRES_INIT,
                services: { db },
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

        test('throws with the init script path and the underlying SQL error', () => {
            // Given - the captured startup failure (init.sql declares a bogus
            // TEXTTTT column type)
            // Then - the error names the failing init script by path AND surfaces
            // The specific SQL error, not a generic "startup failed" wrapper
            expect(caughtError.message).toContain('init script failed');
            expect(caughtError.message).toContain('postgres/init.sql');
            expect(caughtError.message.toLowerCase()).toContain('textttt');
            expect(caughtError.message.toLowerCase()).toContain('does not exist');
        });

        test('error report shows failed service with cross symbol', () => {
            // Given - the captured startup report
            // Then - formatted report includes failure markers AND the unique
            // Failing line (the SQL type error) so the report pinpoints the cause,
            // Not just that some init failed
            const output = stripAnsi(consoleOutput);
            expect(output).toContain('INFRA');
            expect(output).toContain('Starting infrastructure...');
            expect(output).toContain('× postgres (db)');
            expect(output).toContain('init script failed');
            expect(output.toLowerCase()).toContain('textttt');
            expect(output).toContain('app: in-process (Hono)');
        });

        test('error report includes postgres container logs', () => {
            // Given - the captured startup report
            // Then - report includes container log lines from the failing postgres
            const output = stripAnsi(consoleOutput);
            expect(output).toContain('database system is ready to accept connections');
        });
    });

    describe('multi-service failure — redis succeeds, postgres fails', () => {
        let consoleOutput: string;

        beforeAll(async () => {
            // Given - redis (ok) + postgres with broken init.sql (start once)
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const cache = redis({ composeService: 'cache' });
            const db = postgres({ composeService: 'db' });
            const orchestrator = new Orchestrator({
                mode: 'integration',
                root: BROKEN_MULTI_INIT,
                services: { cache, db },
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
            // Given - the captured startup report
            // Then - report shows redis success, then postgres failure
            const output = stripAnsi(consoleOutput);
            expect(output).toContain('✓ redis (cache)');
            expect(output).toContain('× postgres (db)');
            expect(output).toContain('init script failed');
        });

        test('redis appears before postgres in report', () => {
            // Given - the captured startup report
            // Then - redis line comes before postgres line
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
            // Given - db (ok init) + broken-db (bad init) — start once
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const db = postgres({ composeService: 'db' });
            const brokenDb = postgres({ composeService: 'broken-db' });
            const orchestrator = new Orchestrator({
                mode: 'integration',
                root: BROKEN_SECOND_POSTGRES,
                // Insertion order matters: db must be wired (and succeed) before broken-db fails.
                services: { db, 'broken-db': brokenDb },
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
            // Given - the captured startup report
            // Then - first postgres succeeded, second failed
            const output = stripAnsi(consoleOutput);
            expect(output).toContain('✓ postgres (db)');
            expect(output).toContain('× postgres (broken-db)');
            expect(output).toContain('init script failed');
        });

        test('thrown error identifies the broken database', () => {
            // Given - the captured startup failure
            // Then - error includes the broken init path
            expect(caughtError.message).toContain('init script failed');
            expect(caughtError.message).toContain('broken-db/init.sql');
        });

        test('second postgres failure includes its own container logs', () => {
            // Given - the captured startup report
            // Then - logs are from the broken-db container
            const output = stripAnsi(consoleOutput);
            expect(output).toContain('database system is ready to accept connections');
        });
    });
});
