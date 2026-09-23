import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import {
    heldUnreached,
    measure,
    openApiRoutes,
    reachesRoute,
    readLedgers,
    recordUnreached,
    unreachedRoutes,
    writeLedger,
} from './routes.js';

/** A scratch directory, removed when the test ends. */
function scratch(): string {
    const directory = mkdtempSync(join(tmpdir(), 'routes-'));
    onTestFinished(() => {
        rmSync(directory, { force: true, recursive: true });
    });
    return directory;
}

describe('route coverage — what a request reaches', () => {
    test('a parameter takes one segment, a wildcard the rest, and a query is no segment', () => {
        // Given - routes of both parameter spellings and a wildcard
        const byId = { method: 'GET', path: '/users/:id' };
        const braced = { method: 'PUT', path: '/users/{id}' };
        const assets = { method: 'GET', path: '/assets/*' };

        // Then - each reached by what it takes, and nothing else
        expect(reachesRoute(byId, { method: 'GET', path: '/users/7?full=1' })).toBe(true);
        expect(reachesRoute(byId, { method: 'GET', path: '/users/7/posts' })).toBe(false);
        expect(reachesRoute(byId, { method: 'POST', path: '/users/7' })).toBe(false);
        expect(reachesRoute(braced, { method: 'PUT', path: '/users/7' })).toBe(true);
        expect(reachesRoute(assets, { method: 'GET', path: '/assets/css/site.css' })).toBe(true);
    });

    test('names each declared route no request reached, once, in the order declared', () => {
        // Given - a table declaring GET /users twice, and one request
        const declared = [
            { method: 'GET', path: '/users' },
            { method: 'DELETE', path: '/users/:id' },
            { method: 'GET', path: '/users' },
            { method: 'GET', path: '/health' },
        ];

        // Then - the two no request reached
        expect(unreachedRoutes(declared, [{ method: 'GET', path: '/health' }])).toStrictEqual([
            { method: 'GET', path: '/users' },
            { method: 'DELETE', path: '/users/:id' },
        ]);
    });

    test('an OpenAPI document declares every method of every path, YAML or JSON', () => {
        // Given - one path with two methods and a non-method key
        const yaml =
            'paths:\n    /users:\n        get: {}\n        post: {}\n        parameters: []\n';

        // Then - the two methods, whatever the format
        expect(openApiRoutes(yaml, false)).toStrictEqual([
            { method: 'GET', path: '/users' },
            { method: 'POST', path: '/users' },
        ]);
        expect(openApiRoutes('{"paths": {"/a": {"delete": {}}}}', true)).toStrictEqual([
            { method: 'DELETE', path: '/a' },
        ]);
    });
});

describe('route coverage — the ledgers and the ratchet', () => {
    test('every ledger the run wrote is read back, and measured together', () => {
        // Given - two specifications' ledgers
        const directory = join(scratch(), 'routes');
        writeLedger(directory, { declared: [{ method: 'GET', path: '/a' }], reached: [] });
        writeLedger(directory, { declared: [], reached: [{ method: 'GET', path: '/a' }] });

        // Then - one measure over both
        expect(measure(readLedgers(directory))).toStrictEqual({
            declared: [{ method: 'GET', path: '/a' }],
            reached: [{ method: 'GET', path: '/a' }],
        });
    });

    test('recording keeps every other key of the file, and removes its own at zero', () => {
        // Given - a baseline holding a typescript section and a checker key
        const root = scratch();
        const path = join(root, 'jterrazz.baseline.json');
        writeFileSync(
            path,
            '{\n    "typescript": { "a": 1 },\n    "test": { "jterrazz/x": 2 }\n}\n',
        );

        // When - two unreached routes are recorded, then none
        recordUnreached(root, 2);
        const recorded = heldUnreached(root);
        recordUnreached(root, 0);

        // Then - held, then gone, the other keys untouched
        expect(recorded).toBe(2);
        expect(JSON.parse(readFileSync(path, 'utf8'))).toStrictEqual({
            test: { 'jterrazz/x': 2 },
            typescript: { a: 1 },
        });
    });
});
