// invariant: through the package entry: it wires the integration registry the constructors consume (`no-framework-internals`).
import { postgres, redis, specification } from '@jterrazz/test';
/* oxlint-disable jterrazz/runner-in-specification-file -- negative constructor specs:
   every specification.api() call here MUST fail to start, so no runner can
   live in a *.specification.ts file (`runner-in-specification-file`'s sanctioned home is for runners that
   boot). The failure paths themselves are the behaviour under test. */
import { resolve } from 'node:path';
import { describe, expect, test, vi } from 'vitest';

const stripAnsi = (text: string): string => text.replaceAll(/\[[0-9;]*m/gu, '');

const unreachedApp = { request: () => Response.json({}, { status: 200 }) };

const BROKEN_POSTGRES_INIT = resolve(import.meta.dirname, './__fixtures__/broken-postgres-init');
const BROKEN_MULTI_INIT = resolve(import.meta.dirname, './__fixtures__/broken-multi-init');
const BROKEN_SECOND_POSTGRES = resolve(
    import.meta.dirname,
    './__fixtures__/broken-second-postgres',
);

/* invariant: the startup report interleaves live postgres logs and absolute paths, so each test probes the status markers and the thrown error (`output-asserted-as-a-golden` scalpel). */

async function startAndCapture(
    root: string,
    services: NonNullable<Parameters<typeof specification.api>[0]['services']>,
): Promise<{ failure: Error | undefined; output: string }> {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let failure: Error | undefined;
    try {
        const { cleanup } = await specification.api({
            root,
            server: () => unreachedApp,
            services,
        });
        await cleanup();
    } catch (error) {
        failure = error instanceof Error ? error : new Error(String(error));
    }
    const output = stripAnsi(String(spy.mock.calls[0]?.[0] ?? ''));
    spy.mockRestore();
    return { failure, output };
}

const brokenInit = async (): Promise<Capture> =>
    await startAndCapture(BROKEN_POSTGRES_INIT, { db: postgres() });

type Capture = { failure: Error | undefined; output: string };

const missing = (text: string, lines: readonly string[]): string[] =>
    lines.filter((line) => !text.includes(line));

describe('initiation-errors', () => {
    test('postgres init script failure — throws with the init script path and the underlying SQL error', async () => {
        // Given - a postgres whose init.sql declares a bogus TEXTTTT column type
        const { failure } = await brokenInit();

        // Then - the error names the failing init script by path AND surfaces the specific SQL error, not a generic "startup failed" wrapper
        expect(
            missing(failure?.message.toLowerCase() ?? '', [
                'found: the postgres init script ',
                'postgres/init.sql',
                'textttt',
                'does not exist',
            ]),
        ).toStrictEqual([]);
    }, 90_000);

    test('postgres init script failure — the report names the failed service by its record key, the SQL error and the container log', async () => {
        // Given - the same broken start
        const { output } = await brokenInit();

        // Then - the report pinpoints the cause: its markers, the service, the statement the container logged
        expect(
            missing(output, [
                'INFRA',
                'Starting infrastructure...',
                'postgres (db)',
                'found: the postgres init script ',
                'app: in-process (Hono)',
                'STATEMENT:  CREATE TABLE "users" (id SERIAL PRIMARY KEY, name TEXTTTT NOT NULL);',
            ]),
        ).toStrictEqual([]);
        expect(output.toLowerCase()).toContain('textttt');
    }, 90_000);

    test('multi-service failure — redis succeeds, postgres fails — the report shows both services under their record keys, redis first', async () => {
        // Given - a redis that starts and a postgres whose init fails
        const { output } = await startAndCapture(BROKEN_MULTI_INIT, {
            cache: redis(),
            db: postgres(),
        });

        // Then - redis success, then postgres failure
        expect(
            missing(output, ['redis (cache)', 'postgres (db)', 'found: the postgres init script ']),
        ).toStrictEqual([]);
        expect(output.indexOf('redis (cache)')).toBeLessThan(output.indexOf('postgres (db)'));
    }, 90_000);

    test('multi-postgres failure — first succeeds, second fails — the report and the error name the broken database, with its own logs', async () => {
        // Given - two postgres, the second with a failing init: `db` must be wired and succeed before `brokenDb` fails
        const { failure, output } = await startAndCapture(BROKEN_SECOND_POSTGRES, {
            db: postgres(),
            brokenDb: postgres(),
        });

        // Then - both databases by their record keys, the broken one's script in the error and its statement in its logs
        expect(
            missing(output, [
                'postgres (db)',
                'postgres (broken-db)',
                'found: the postgres init script ',
                'STATEMENT:  CREATE TABLE "events" (id SERIAL PRIMARY KEY, type TEXTTTT NOT NULL);',
            ]),
        ).toStrictEqual([]);
        expect(
            missing(failure?.message ?? '', [
                'found: the postgres init script ',
                'broken-db/init.sql',
            ]),
        ).toStrictEqual([]);
    }, 90_000);
});
