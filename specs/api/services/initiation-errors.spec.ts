/* oxlint-disable jterrazz/runner-in-specification-file -- negative constructor specs:
   every specification.api() call here MUST fail to start, so no runner can
   live in a *.specification.ts file (`runner-in-specification-file`'s sanctioned home is for runners that
   boot). The failure paths themselves are the behaviour under test. */
import { resolve } from 'node:path';
import { beforeAll, describe, expect, test, vi } from 'vitest';

// Through the package entry: it wires the integration registry the constructors consume (`no-framework-internals`).
import { postgres, redis, specification } from '../../../src/index.js';

const stripAnsi = (text: string): string => text.replaceAll(/\[[0-9;]*m/gu, '');

const unreachedApp = { request: () => Response.json({}, { status: 200 }) };

const BROKEN_POSTGRES_INIT = resolve(
    import.meta.dirname,
    '../../shared/fixtures/broken-postgres-init',
);
const BROKEN_MULTI_INIT = resolve(import.meta.dirname, '../../shared/fixtures/broken-multi-init');
const BROKEN_SECOND_POSTGRES = resolve(
    import.meta.dirname,
    '../../shared/fixtures/broken-second-postgres',
);

/* The startup report interleaves live postgres logs and absolute paths, so each test probes the status markers and the thrown error (`output-asserted-as-a-golden` scalpel). */

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

type Capture = { failure: Error | undefined; output: string };

describe('initiation-errors', () => {
    // Three refusals, each a container start, captured once and read by eight tests: the hook pays for the containers, not for a Given.
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
        // `db` must be wired and succeed before `brokenDb` fails.
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
        // Then - report includes the line the container logged for the failing statement, which only its logs carry
        expect(brokenInit.output).toContain(
            'STATEMENT:  CREATE TABLE "users" (id SERIAL PRIMARY KEY, name TEXTTTT NOT NULL);',
        );
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
        // Then - the logs hold the statement of broken-db's own script
        expect(multiPostgres.output).toContain(
            'STATEMENT:  CREATE TABLE "events" (id SERIAL PRIMARY KEY, type TEXTTTT NOT NULL);',
        );
    });
});
