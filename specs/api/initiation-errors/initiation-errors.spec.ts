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

/** What one refused startup left behind: the error it threw, the report it printed. */
type Capture = { failure: Error | undefined; output: string };

describe('initiation errors', () => {
    // Three refusals, each costing a container start, captured once and read by
    // Eight tests. The hook is the price of the containers, not of the Given:
    // Every test below reads a value this file named, and names which one.
    let brokenInit: Capture;
    let multiService: Capture;
    let multiPostgres: Capture;

    beforeAll(async () => {
        // Given - the three broken starts, each run once
        brokenInit = await startAndCapture(BROKEN_POSTGRES_INIT, { db: postgres() });
        multiService = await startAndCapture(BROKEN_MULTI_INIT, {
            cache: redis(),
            db: postgres(),
        });
        // Insertion order matters: `db` must be wired (and succeed) before
        // `brokenDb` fails, and the kebab-case of each key names the folder its
        // Init sits in.
        multiPostgres = await startAndCapture(BROKEN_SECOND_POSTGRES, {
            db: postgres(),
            brokenDb: postgres(),
        });
    }, 90_000);

    test('postgres init script failure — throws with the init script path and the underlying SQL error', () => {
        // Given - the captured startup failure (init.sql declares a bogus TEXTTTT column type)
        // Then - the error names the failing init script by path AND surfaces the specific SQL error, not a generic "startup failed" wrapper
        expect(brokenInit.failure?.message).toContain('init script failed');
        expect(brokenInit.failure?.message).toContain('postgres/init.sql');
        expect(brokenInit.failure?.message.toLowerCase()).toContain('textttt');
        expect(brokenInit.failure?.message.toLowerCase()).toContain('does not exist');
    });

    test('postgres init script failure — error report shows the failed service, named after its record key', () => {
        // Given - the captured startup report
        // Then - formatted report includes failure markers AND the unique failing line (the SQL type error) so the report pinpoints the cause, not just that some init failed
        expect(brokenInit.output).toContain('INFRA');
        expect(brokenInit.output).toContain('Starting infrastructure...');
        expect(brokenInit.output).toContain('postgres (db)');
        expect(brokenInit.output).toContain('init script failed');
        expect(brokenInit.output.toLowerCase()).toContain('textttt');
        expect(brokenInit.output).toContain('app: in-process (Hono)');
    });

    test('postgres init script failure — error report includes postgres container logs', () => {
        // Given - the captured startup report
        // Then - report includes container log lines from the failing postgres
        expect(brokenInit.output).toContain('database system is ready to accept connections');
    });

    test('multi-service failure — redis succeeds, postgres fails — error report shows both services under their record keys', () => {
        // Given - the captured startup report
        // Then - report shows redis success, then postgres failure
        expect(multiService.output).toContain('redis (cache)');
        expect(multiService.output).toContain('postgres (db)');
        expect(multiService.output).toContain('init script failed');
    });

    test('multi-service failure — redis succeeds, postgres fails — redis appears before postgres in report', () => {
        // Given - the captured startup report
        // Then - redis line comes before postgres line
        const redisIndex = multiService.output.indexOf('redis (cache)');
        const postgresIndex = multiService.output.indexOf('postgres (db)');
        expect(redisIndex).toBeLessThan(postgresIndex);
    });

    test('multi-postgres failure — first succeeds, second fails — error report names both databases by their record keys', () => {
        // Given - the captured startup report
        // Then - first postgres succeeded, second failed
        expect(multiPostgres.output).toContain('postgres (db)');
        expect(multiPostgres.output).toContain('postgres (broken-db)');
        expect(multiPostgres.output).toContain('init script failed');
    });

    test('multi-postgres failure — first succeeds, second fails — thrown error identifies the broken database', () => {
        // Given - the captured startup failure
        // Then - error includes the broken init path
        expect(multiPostgres.failure?.message).toContain('init script failed');
        expect(multiPostgres.failure?.message).toContain('broken-db/init.sql');
    });

    test('multi-postgres failure — first succeeds, second fails — second postgres failure includes its own container logs', () => {
        // Given - the captured startup report
        // Then - logs are from the broken-db container
        expect(multiPostgres.output).toContain('database system is ready to accept connections');
    });
});
