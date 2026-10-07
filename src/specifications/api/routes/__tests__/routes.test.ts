import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { declaredRoutes, openApiRoutes, reachesRoute, unreachedRoutes } from '../routes.js';

const project = (routes: string | undefined, documents: Record<string, string>): string => {
    const root = mkdtempSync(join(tmpdir(), 'routes-'));
    writeFileSync(join(root, 'package.json'), '{ "name": "routes", "type": "module" }\n');
    const section = routes === undefined ? '{}' : `{ routes: '${routes}' }`;
    writeFileSync(
        join(root, 'jterrazz.config.ts'),
        `export default { kind: 'library', platform: 'node', test: ${section} };\n`,
    );
    for (const [name, text] of Object.entries(documents)) {
        writeFileSync(join(root, name), text);
    }
    return root;
};

describe('routes', () => {
    test('route coverage — what a request reaches — a parameter takes one segment, a wildcard the rest, and a query is no segment', () => {
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

    test('route coverage — what a request reaches — a request written as a template is matched by its template, not by the path it filled', () => {
        // Given - an item route, a literal route its path would also fill, and one OpenAPI spelling
        const byId = { method: 'GET', path: '/users/:id' };
        const me = { method: 'GET', path: '/users/me' };
        const braced = { method: 'GET', path: '/users/{id}' };

        // Then - the template reaches the parameter's route alone, whatever the parameter is called
        const templated = { method: 'GET', path: '/users/me', template: '/users/:userId' };
        expect(reachesRoute(byId, templated)).toBe(true);
        expect(reachesRoute(braced, templated)).toBe(true);
        expect(reachesRoute(me, templated)).toBe(false);
    });

    test('route coverage — what a request reaches — a literal path stated as its template reaches the literal route alone; unstated, every route it fits', () => {
        // Given - an item route and the literal route its path also fills
        const byId = { method: 'GET', path: '/users/:id' };
        const me = { method: 'GET', path: '/users/me' };

        // Then - `{ params: {} }` made the path its own template; a bare path is read by its segments
        const literal = { method: 'GET', path: '/users/me', template: '/users/me' };
        expect(reachesRoute(me, literal)).toBe(true);
        expect(reachesRoute(byId, literal)).toBe(false);
        expect(reachesRoute(me, { method: 'GET', path: '/users/me' })).toBe(true);
        expect(reachesRoute(byId, { method: 'GET', path: '/users/me' })).toBe(true);
    });

    test('route coverage — what a request reaches — names each declared route no request reached, once, in the order declared', () => {
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

    test('route coverage — what a request reaches — an OpenAPI document declares every method of every path, YAML or JSON', () => {
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

    test('route coverage — what a request reaches — the edges of a match: ALL, a short path, an empty segment, a wildcard’s prefix, a braced name in part', () => {
        // Given - routes and requests at each edge
        const pairs: [string, string, string][] = [
            ['ALL /health', 'DELETE', '/health'],
            ['GET /a/:id/*', 'GET', '/a'],
            ['GET /users/:id', 'GET', '/users/'],
            ['GET /a/b/*', 'GET', '/a/x/c'],
            ['GET /a/b/*', 'GET', '/a/b/c/d'],
            ['GET /users/{id}x', 'GET', '/users/7'],
            ['GET /users/x{id}', 'GET', '/users/7'],
            ['GET /users/{id}x', 'GET', '/users/{id}x'],
        ];

        // Then - which each request reaches
        expect(
            pairs.map(([declared, method, path]) => {
                const [routeMethod = '', routePath = ''] = declared.split(' ');
                return reachesRoute({ method: routeMethod, path: routePath }, { method, path });
            }),
        ).toStrictEqual([true, false, false, false, true, false, false, true]);
    });

    test('route coverage — an OpenAPI document — with no paths, paths of another shape, or a path item of another shape declares nothing there', () => {
        // Given - documents with no paths, with paths a list, of another shape, and with one path item null
        // Then - nothing from each
        expect([
            openApiRoutes('{}', true),
            openApiRoutes('{"paths": []}', true),
            openApiRoutes('[]', true),
            openApiRoutes('{"paths": {"/a": null, "/b": {"get": {}}}}', true),
        ]).toStrictEqual([[], [], [], [{ method: 'GET', path: '/b' }]]);
    });

    test('route coverage — declaredRoutes — reads the document a project names, JSON by its extension and YAML otherwise, and none when it names none', async () => {
        // Given - projects naming a JSON document, a YAML one, and none

        // Then - each project's routes
        expect([
            await declaredRoutes(
                project('openapi.json', { 'openapi.json': '{"paths": {"/a": {"get": {}}}}' }),
            ),
            await declaredRoutes(
                project('openapi.yaml', { 'openapi.yaml': 'paths:\n    /b:\n        post: {}\n' }),
            ),
            await declaredRoutes(project(undefined, {})),
        ]).toStrictEqual([
            [{ method: 'GET', path: '/a' }],
            [{ method: 'POST', path: '/b' }],
            undefined,
        ]);
    });
});
