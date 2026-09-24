import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { heldUnreached, writeLedger } from '../model/routes/routes.js';
import { judgeRoutes, UNKNOWN_TABLE } from './route-coverage.js';

/** A project root holding one run's ledgers: two specifications of one table of three routes, one request. */
function runWithOneRouteReached(): { directory: string; root: string } {
    const root = mkdtempSync(join(tmpdir(), 'route-coverage-'));
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

describe('route coverage — the api run judged', () => {
    test('a declared route no test reached fails the run, naming each', async () => {
        // Given - a run reaching one route of three, and no ratchet
        const { directory, root } = runWithOneRouteReached();

        // Then - the failure names the two
        await expect(judgeRoutes(root, directory, false)).resolves.toStrictEqual({
            failure:
                'api routes: 2 declared route(s) no test reached, the ratchet holds 0 — send each from a spec, or record them with TEST_UPDATE=1:\n  GET /users\n  DELETE /users/:id',
        });
    });

    test('update mode records where the run stands, and the next run is held by it', async () => {
        // Given - the same run, recorded
        const { directory, root } = runWithOneRouteReached();
        await judgeRoutes(root, directory, true);

        // Then - two held, and the judged run passes naming them
        expect(heldUnreached(root)).toBe(2);
        await expect(judgeRoutes(root, directory, false)).resolves.toStrictEqual({
            line: 'api routes: 2 unreached, held by jterrazz.baseline.json › test › routes/unreached:\n  GET /users\n  DELETE /users/:id',
        });
    });

    test('a run that reaches more than the ratchet holds fails, until it is recorded', async () => {
        // Given - the run recorded, then one more route reached
        const { directory, root } = runWithOneRouteReached();
        await judgeRoutes(root, directory, true);
        writeLedger(directory, { declared: [], reached: [{ method: 'GET', path: '/users' }] });

        // Then - the fall is a failure naming the gesture; recorded, the run passes
        await expect(judgeRoutes(root, directory, false)).resolves.toStrictEqual({
            failure:
                'api routes: 1 declared route(s) no test reached, below the 2 the ratchet holds — the debt fell, record it with TEST_UPDATE=1',
        });
        await judgeRoutes(root, directory, true);
        expect(heldUnreached(root)).toBe(1);
    });

    test('a route two specifications declare counts once', async () => {
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
        await expect(judgeRoutes(root, directory, false)).resolves.toStrictEqual({
            line: 'api routes: all 3 declared routes reached',
        });
    });

    test('a declared OpenAPI document is the table, when the member states one', async () => {
        // Given - the member declares only the route the run reached
        const { directory, root } = runWithOneRouteReached();
        writeFileSync(join(root, 'openapi.json'), '{"paths": {"/users/{id}": {"get": {}}}}');
        writeFileSync(
            join(root, 'jterrazz.config.ts'),
            "export default { test: { routes: './openapi.json' } };\n",
        );

        // Then - every declared route reached
        await expect(judgeRoutes(root, directory, false)).resolves.toStrictEqual({
            line: 'api routes: all 1 declared routes reached',
        });
    });

    test('a run no api specification wrote to says nothing', async () => {
        // Given - an empty ledger folder
        const root = mkdtempSync(join(tmpdir(), 'route-coverage-'));
        onTestFinished(() => {
            rmSync(root, { force: true, recursive: true });
        });

        // Then - nothing to judge
        await expect(judgeRoutes(root, join(root, 'ledgers'), false)).resolves.toStrictEqual({});
    });

    test('an app whose table is unknown fails the run, naming how to declare it', async () => {
        // Given - a specification whose app exposed no route table, and no OpenAPI document
        const { directory, root } = runWithOneRouteReached();
        writeLedger(directory, { reached: [{ method: 'GET', path: '/health' }] });

        // Then - the run fails rather than reading as every route reached
        await expect(judgeRoutes(root, directory, false)).resolves.toStrictEqual({
            failure: UNKNOWN_TABLE,
        });
    });

    test('an app whose table is unknown is measured against the OpenAPI document it declares', async () => {
        // Given - no table from the app, the one route declared in a document, and reached
        const root = mkdtempSync(join(tmpdir(), 'route-coverage-'));
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
        await expect(judgeRoutes(root, directory, false)).resolves.toStrictEqual({
            line: 'api routes: all 1 declared routes reached',
        });
    });

    test('an ALL route is reached by a request of any method', async () => {
        // Given - one app.all() route, reached by a POST
        const root = mkdtempSync(join(tmpdir(), 'route-coverage-'));
        onTestFinished(() => {
            rmSync(root, { force: true, recursive: true });
        });
        const directory = join(root, 'ledgers');
        writeLedger(directory, {
            declared: [{ method: 'ALL', path: '/mcp' }],
            reached: [{ method: 'POST', path: '/mcp' }],
        });

        // Then - reached
        await expect(judgeRoutes(root, directory, false)).resolves.toStrictEqual({
            line: 'api routes: all 1 declared routes reached',
        });
    });
});
