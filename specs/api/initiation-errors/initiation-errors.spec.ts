/* oxlint-disable jterrazz/a1-specification-file -- negative constructor specs:
   every specification.api() call here MUST fail to start, so no runner can
   live in a *.specification.ts file (A1's sanctioned home is for runners that
   boot). The failure paths themselves are the behaviour under test. */
import { resolve } from 'node:path';
import { beforeAll, describe, expect, test, vi } from 'vitest';

// Import via the package entry point — it wires the integration registry the
// Constructors consume, and it is the door a spec reaches the framework
// Through (rule F3).
import { postgres, redis, specification } from '../../../src/index.js';

const stripAnsi = (text: string): string => text.replaceAll(/\[[0-9;]*m/gu, '');

/** A Hono-compatible app the constructor never reaches: startup fails first. */
const unreachedApp = { request: () => Response.json({}, { status: 200 }) };

const BROKEN_POSTGRES_INIT = resolve(import.meta.dirname, '../../_fixtures/broken-postgres-init');
const BROKEN_MULTI_INIT = resolve(import.meta.dirname, '../../_fixtures/broken-multi-init');
const BROKEN_SECOND_POSTGRES = resolve(
    import.meta.dirname,
    '../../_fixtures/broken-second-postgres',
);

/*
 * Scalpel by design: the captured console report interleaves the startup status
 * lines with live postgres container logs and absolute init-script paths — a full
 * snapshot is unstable by nature (third-party logs, timing, paths). Each test
 * probes the status markers / error text that prove the failure behaviour;
 * the message assertions probe the thrown Error, not a stream.
 */

/** Start a specification that must fail, capturing the report it printed. */
async function startAndCapture(
    root: string,
    services: Record<string, unknown>,
): Promise<{ failure: Error | undefined; output: string }> {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let failure: Error | undefined;
    try {
        const { cleanup } = await specification.api({
            root,
            server: () => unreachedApp,
            services: services as never,
        });
        await cleanup();
    } catch (error: any) {
        failure = error;
    }
    const output = stripAnsi(spy.mock.calls[0]?.[0] ?? '');
    spy.mockRestore();
    return { failure, output };
}

describe('initiation errors', () => {
    describe('postgres init script failure', () => {
        let caught: Error | undefined;
        let output: string;

        beforeAll(async () => {
            // Given - postgres with broken init.sql (start once, assert many)
            ({ failure: caught, output } = await startAndCapture(BROKEN_POSTGRES_INIT, {
                db: postgres(),
            }));
        }, 30_000);

        test('throws with the init script path and the underlying SQL error', () => {
            // Given - the captured startup failure (init.sql declares a bogus
            // TEXTTTT column type)
            // Then - the error names the failing init script by path AND surfaces
            // The specific SQL error, not a generic "startup failed" wrapper
            expect(caught?.message).toContain('init script failed');
            expect(caught?.message).toContain('postgres/init.sql');
            expect(caught?.message.toLowerCase()).toContain('textttt');
            expect(caught?.message.toLowerCase()).toContain('does not exist');
        });

        test('error report shows the failed service, named after its record key', () => {
            // Given - the captured startup report
            // Then - formatted report includes failure markers AND the unique
            // Failing line (the SQL type error) so the report pinpoints the cause,
            // Not just that some init failed
            expect(output).toContain('INFRA');
            expect(output).toContain('Starting infrastructure...');
            expect(output).toContain('postgres (db)');
            expect(output).toContain('init script failed');
            expect(output.toLowerCase()).toContain('textttt');
            expect(output).toContain('app: in-process (Hono)');
        });

        test('error report includes postgres container logs', () => {
            // Given - the captured startup report
            // Then - report includes container log lines from the failing postgres
            expect(output).toContain('database system is ready to accept connections');
        });
    });

    describe('multi-service failure — redis succeeds, postgres fails', () => {
        let output: string;

        beforeAll(async () => {
            // Given - redis (ok) + postgres with broken init.sql (start once)
            ({ output } = await startAndCapture(BROKEN_MULTI_INIT, {
                cache: redis(),
                db: postgres(),
            }));
        }, 30_000);

        test('error report shows both services under their record keys', () => {
            // Given - the captured startup report
            // Then - report shows redis success, then postgres failure
            expect(output).toContain('redis (cache)');
            expect(output).toContain('postgres (db)');
            expect(output).toContain('init script failed');
        });

        test('redis appears before postgres in report', () => {
            // Given - the captured startup report
            // Then - redis line comes before postgres line
            const redisIndex = output.indexOf('redis (cache)');
            const postgresIndex = output.indexOf('postgres (db)');
            expect(redisIndex).toBeLessThan(postgresIndex);
        });
    });

    describe('multi-postgres failure — first succeeds, second fails', () => {
        let caught: Error | undefined;
        let output: string;

        beforeAll(async () => {
            // Given - db (ok init) + brokenDb (bad init) — start once. Insertion
            // Order matters: db must be wired (and succeed) before brokenDb fails,
            // And the kebab-case of each key names the folder its init sits in.
            ({ failure: caught, output } = await startAndCapture(BROKEN_SECOND_POSTGRES, {
                db: postgres(),
                brokenDb: postgres(),
            }));
        }, 30_000);

        test('error report names both databases by their record keys', () => {
            // Given - the captured startup report
            // Then - first postgres succeeded, second failed
            expect(output).toContain('postgres (db)');
            expect(output).toContain('postgres (broken-db)');
            expect(output).toContain('init script failed');
        });

        test('thrown error identifies the broken database', () => {
            // Given - the captured startup failure
            // Then - error includes the broken init path
            expect(caught?.message).toContain('init script failed');
            expect(caught?.message).toContain('broken-db/init.sql');
        });

        test('second postgres failure includes its own container logs', () => {
            // Given - the captured startup report
            // Then - logs are from the broken-db container
            expect(output).toContain('database system is ready to accept connections');
        });
    });
});
