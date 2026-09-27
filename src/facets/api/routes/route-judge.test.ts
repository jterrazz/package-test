import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { heldUnreached } from '../../../../lint/engine/baseline/test-baseline.js';
import type { Lesson } from '../../../../lint/index.refusal.js';
import { writeLedger } from './ledger.js';
import { judgeRoutes, PARTIAL_UNJUDGED, SHARD_UNJUDGED, UNKNOWN_TABLE } from './route-judge.js';

const GREEN = { failed: 0, scope: 'whole', update: false } as const;

const RECORDING = { failed: 0, scope: 'whole', update: true } as const;

function methodlessDrift(...drift: string[]): { failure: Lesson } {
    return {
        failure: {
            fix: 'state in `test: { methodless }` exactly the routes the app takes on any method',
            found: `api routes: \`test: { methodless }\` in jterrazz.config.ts drifted from the app's table:\n${drift.join('\n')}`,
            read: 'docs/10-api.md#a-route-taken-on-any-method',
            why: '`test: { methodless }` names the routes the app takes on any method, which the checker files by their path, whatever verb a spec sends.',
        },
    };
}

function runWithOneRouteReached(): { directory: string; root: string } {
    const root = mkdtempSync(join(tmpdir(), 'route-judge-'));
    onTestFinished(() => {
        rmSync(root, { force: true, recursive: true });
    });
    const directory = join(root, 'ledgers');
    const declared = [
        { method: 'GET', path: '/users' },
        { method: 'GET', path: '/users/:id' },
        { method: 'DELETE', path: '/users/:id' },
    ];
    writeLedger(directory, { declared, reached: [{ method: 'GET', path: '/users/7' }] });
    writeLedger(directory, { declared, reached: [] });
    return { directory, root };
}

describe('route-judge', () => {
    test('route judge — the api run judged — a declared route no test reached fails the run, naming each', async () => {
        // Given - a run reaching one route of three, and no ratchet
        const { directory, root } = runWithOneRouteReached();

        // Then - the failure names the two
        await expect(judgeRoutes(root, directory, GREEN)).resolves.toStrictEqual({
            failure: {
                fix: 'send each from a spec, or record them with TEST_UPDATE=1',
                found: 'api routes: 2 declared route(s) no test reached, and the ratchet holds 0:\n  GET /users\n  DELETE /users/:id',
                read: 'docs/10-api.md#the-ratchet',
                why: 'A route no test reached fails the run, beyond the count the ratchet holds.',
            },
        });
    });

    test('route judge — the api run judged — update mode records where the run stands, and the next run is held by it', async () => {
        // Given - the same run, recorded
        const { directory, root } = runWithOneRouteReached();
        await judgeRoutes(root, directory, RECORDING);

        // Then - two held, and the judged run passes naming them
        expect(heldUnreached(root)).toBe(2);
        await expect(judgeRoutes(root, directory, GREEN)).resolves.toStrictEqual({
            line: 'api routes: 2 unreached, held by jterrazz.baseline.json › test › routes/unreached:\n  GET /users\n  DELETE /users/:id',
        });
    });

    test('route judge — the api run judged — a run that reaches more than the ratchet holds fails, until it is recorded', async () => {
        // Given - the run recorded, then one more route reached
        const { directory, root } = runWithOneRouteReached();
        await judgeRoutes(root, directory, RECORDING);
        writeLedger(directory, { declared: [], reached: [{ method: 'GET', path: '/users' }] });

        // Then - the fall is a failure naming the gesture; recorded, the run passes
        await expect(judgeRoutes(root, directory, GREEN)).resolves.toStrictEqual({
            failure: {
                fix: 'the debt fell: record it with TEST_UPDATE=1',
                found: 'api routes: 1 declared route(s) no test reached, below the 2 the ratchet holds',
                read: 'docs/10-api.md#the-ratchet',
                why: 'The ratchet is exact in both directions.',
            },
        });
        await judgeRoutes(root, directory, RECORDING);
        expect(heldUnreached(root)).toBe(1);
    });

    test('route judge — the api run judged — update mode refuses to record a run a file of which failed, and keeps the entry', async () => {
        // Given - the run recorded, then the same run judged for recording with one failed file and one route fewer reached
        const { directory, root } = runWithOneRouteReached();
        await judgeRoutes(root, directory, RECORDING);
        writeLedger(directory, { declared: [], reached: [{ method: 'GET', path: '/users' }] });

        // Then - the refusal names why, and the ratchet still holds where the green run stood
        await expect(
            judgeRoutes(root, directory, { failed: 1, scope: 'whole', update: true }),
        ).resolves.toStrictEqual({
            failure: {
                fix: 'make the run green, then record with TEST_UPDATE=1',
                found: 'api routes: not recorded — 1 file(s) of the run failed, and a failed file may not have sent its requests',
                read: 'docs/10-api.md#when-a-run-is-not-judged',
                why: 'The route ratchet is recorded only from a run that is green and whole.',
            },
        });
        expect(heldUnreached(root)).toBe(2);
    });

    test('route judge — the api run judged — a run a file of which failed is not judged: the routes it did not reach are no failure of theirs', async () => {
        // Given - a run reaching one route of three, the ratchet holding none, and two files failed
        const { directory, root } = runWithOneRouteReached();

        // Then - one neutral line, never the ratchet's failure naming routes the failed files may have sent
        await expect(
            judgeRoutes(root, directory, { failed: 2, scope: 'whole', update: false }),
        ).resolves.toStrictEqual({
            line: 'api routes: not judged — 2 file(s) of the run failed, and a failed file may not have sent its requests',
        });
    });

    test('route judge — the api run judged — a route two specifications declare counts once', async () => {
        // Given - the same table in two ledgers, every route reached
        const { directory, root } = runWithOneRouteReached();
        writeLedger(directory, {
            declared: [],
            reached: [
                { method: 'GET', path: '/users' },
                { method: 'DELETE', path: '/users/7' },
            ],
        });

        // Then - three routes, not six
        await expect(judgeRoutes(root, directory, GREEN)).resolves.toStrictEqual({
            line: 'api routes: all 3 declared routes reached',
        });
    });

    test('route judge — the api run judged — a declared OpenAPI document is the table, when the member states one', async () => {
        // Given - the member declares only the route the run reached
        const { directory, root } = runWithOneRouteReached();
        writeFileSync(join(root, 'openapi.json'), '{"paths": {"/users/{id}": {"get": {}}}}');
        writeFileSync(
            join(root, 'jterrazz.config.ts'),
            "export default { test: { routes: './openapi.json' } };\n",
        );

        // Then - every declared route reached
        await expect(judgeRoutes(root, directory, GREEN)).resolves.toStrictEqual({
            line: 'api routes: all 1 declared routes reached',
        });
    });

    test('route judge — the api run judged — a run no api specification wrote to says nothing', async () => {
        // Given - an empty ledger folder
        const root = mkdtempSync(join(tmpdir(), 'route-judge-'));
        onTestFinished(() => {
            rmSync(root, { force: true, recursive: true });
        });

        // Then - nothing to judge
        await expect(judgeRoutes(root, join(root, 'ledgers'), GREEN)).resolves.toStrictEqual({});
    });

    test('route judge — the api run judged — an app whose table is unknown fails the run, naming how to declare it', async () => {
        // Given - a specification whose app exposed no route table, and no OpenAPI document
        const { directory, root } = runWithOneRouteReached();
        writeLedger(directory, { reached: [{ method: 'GET', path: '/health' }] });

        // Then - the run fails rather than reading as every route reached
        await expect(judgeRoutes(root, directory, GREEN)).resolves.toStrictEqual({
            failure: UNKNOWN_TABLE,
        });
    });

    test('route judge — the api run judged — an app whose table is unknown is measured against the OpenAPI document it declares', async () => {
        // Given - no table from the app, the one route declared in a document, and reached
        const root = mkdtempSync(join(tmpdir(), 'route-judge-'));
        onTestFinished(() => {
            rmSync(root, { force: true, recursive: true });
        });
        const directory = join(root, 'ledgers');
        writeLedger(directory, { reached: [{ method: 'GET', path: '/health' }] });
        writeFileSync(join(root, 'openapi.json'), '{"paths": {"/health": {"get": {}}}}');
        writeFileSync(
            join(root, 'jterrazz.config.ts'),
            "export default { test: { routes: './openapi.json' } };\n",
        );

        // Then - measured against the document
        await expect(judgeRoutes(root, directory, GREEN)).resolves.toStrictEqual({
            line: 'api routes: all 1 declared routes reached',
        });
    });

    test('route judge — the api run judged — an ALL route is reached by a request of any method', async () => {
        // Given - one app.all() route the member declares method-less, reached by a POST
        const { directory, root } = methodlessRun(['/mcp']);

        // Then - reached
        await expect(judgeRoutes(root, directory, GREEN)).resolves.toStrictEqual({
            line: 'api routes: all 2 declared routes reached',
        });
    });

    test('route judge — the api run judged — an ALL route the member does not declare method-less fails the run, in update mode too', async () => {
        // Given - the app takes /mcp on any method, and jterrazz.config.ts names no route so
        const { directory, root } = methodlessRun([]);

        // Then - the drift is named, whatever the mode
        const failure = methodlessDrift(
            "  ALL /mcp — the app takes it on any method, and the list misses it: add '/mcp'",
        );
        await expect(judgeRoutes(root, directory, GREEN)).resolves.toStrictEqual(failure);
        await expect(judgeRoutes(root, directory, RECORDING)).resolves.toStrictEqual(failure);
    });

    test('route judge — the api run judged — a method-less route the app takes on its own methods only, or not at all, fails the run', async () => {
        // Given - /mcp, /health and /gone declared method-less, the app taking /health on GET alone and no /gone
        const { directory, root } = methodlessRun(['/mcp', '/health', '/gone']);

        // Then - each declaration that drifted is named
        await expect(judgeRoutes(root, directory, GREEN)).resolves.toStrictEqual(
            methodlessDrift(
                "  /health — the list names it, and the app takes it on its own methods only: remove '/health'",
                "  /gone — the list names it, and the app's table holds no such route: remove '/gone'",
            ),
        );
    });

    test('route judge — the api run judged — the method-less list is held to the app’s own table, even when an OpenAPI document measures the coverage', async () => {
        // Given - the app takes /mcp on any method, and the member declares a document that knows only its POST
        const { directory, root } = methodlessRun(['/mcp']);
        writeFileSync(
            join(root, 'openapi.json'),
            '{"paths": {"/mcp": {"post": {}}, "/health": {"get": {}}}}',
        );
        writeFileSync(
            join(root, 'jterrazz.config.ts'),
            "export default { test: { methodless: ['/mcp'], routes: './openapi.json' } };\n",
        );

        // Then - the list agrees with the app, and the document's routes are reached
        await expect(judgeRoutes(root, directory, GREEN)).resolves.toStrictEqual({
            line: 'api routes: all 2 declared routes reached',
        });
    });

    test('route judge — the api run judged — a method-less route is the app’s whatever its parameters are named', async () => {
        // Given - the app takes /mcp/:id on any method, the list naming /mcp/:session, then /mcp/:id/x
        const agreeing = methodlessRun(['/mcp/:session'], '/mcp/:id');
        const drifted = methodlessRun(['/mcp/:id/x'], '/mcp/:id');

        // Then - one route by its shape, and a deeper path is another route
        await expect(judgeRoutes(agreeing.root, agreeing.directory, GREEN)).resolves.toStrictEqual({
            line: 'api routes: all 2 declared routes reached',
        });
        await expect(judgeRoutes(drifted.root, drifted.directory, GREEN)).resolves.toStrictEqual(
            methodlessDrift(
                "  ALL /mcp/:id — the app takes it on any method, and the list misses it: add '/mcp/:id'",
                "  /mcp/:id/x — the list names it, and the app's table holds no such route: remove '/mcp/:id/x'",
            ),
        );
    });

    test('route judge — a shard of a split run — a shard judges nothing, and records nothing, whatever its ledgers reached', async () => {
        // Given - one shard's ledgers, reaching one route of three
        const { directory, root } = runWithOneRouteReached();

        // Then - no failure, judged or recording, and no entry written
        await expect(
            Promise.all(
                [false, true].map(
                    async (update) =>
                        await judgeRoutes(root, directory, { failed: 0, scope: 'shard', update }),
                ),
            ),
        ).resolves.toStrictEqual([{ line: SHARD_UNJUDGED }, { line: SHARD_UNJUDGED }]);
        expect(heldUnreached(root)).toBe(0);
    });

    test('route judge — a partial run — a partial run judges nothing, and records nothing, whatever its ledgers reached', async () => {
        // Given - the ledgers of a run of some of the project's files, reaching one route of three
        const { directory, root } = runWithOneRouteReached();

        // Then - no failure, judged or recording, and no entry written
        await expect(
            Promise.all(
                [false, true].map(
                    async (update) =>
                        await judgeRoutes(root, directory, { failed: 0, scope: 'partial', update }),
                ),
            ),
        ).resolves.toStrictEqual([{ line: PARTIAL_UNJUDGED }, { line: PARTIAL_UNJUDGED }]);
        expect(heldUnreached(root)).toBe(0);
    });
});

function methodlessRun(
    methodless: readonly string[],
    any = '/mcp',
): { directory: string; root: string } {
    const root = mkdtempSync(join(tmpdir(), 'route-judge-'));
    onTestFinished(() => {
        rmSync(root, { force: true, recursive: true });
    });
    const directory = join(root, 'ledgers');
    writeLedger(directory, {
        declared: [
            { method: 'ALL', path: any },
            { method: 'GET', path: '/health' },
        ],
        reached: [
            { method: 'POST', path: any.replaceAll(/:[^/]+/gu, '7') },
            { method: 'GET', path: '/health' },
        ],
    });
    writeFileSync(
        join(root, 'jterrazz.config.ts'),
        `export default { test: { methodless: ${JSON.stringify(methodless)} } };\n`,
    );
    return { directory, root };
}
