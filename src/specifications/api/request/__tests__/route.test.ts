import { describe, expect, test } from 'vitest';

import { routeRequest } from '../route.js';

function refused(found: string, call: string): string {
    return [
        `found: ${found}`,
        'why: A request written as its route template is handed exactly the parameters the template names.',
        `fix: write ${call}`,
        'read: docs/reference/linting.md#route-written-as-template-at-runtime',
    ].join('\n');
}

function refusalOf(work: () => unknown): string {
    try {
        work();
        return '';
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
}

describe('route', () => {
    test('routeRequest — fills the template with its params, each value encoded, the query kept', () => {
        // Given - a template with two parameters and a query
        const request = routeRequest('GET', '/indicators/:symbol/points/:at?range=1D', {
            params: { at: 3, symbol: 'btc/usd' },
        });

        // Then - the path the app is sent, and the template the test wrote
        expect(request).toStrictEqual({
            path: '/indicators/btc%2Fusd/points/3?range=1D',
            template: '/indicators/:symbol/points/:at?range=1D',
        });
    });

    test('routeRequest — sends a path with no parameter as written — a colon opening no identifier is none — and `{ params: {} }` makes it the template', () => {
        // Given - the same literal path, bare and stated as the route
        // Then - bare, no template is read; stated, the path is its own template
        expect(routeRequest('GET', '/users/me')).toStrictEqual({ path: '/users/me' });
        expect(routeRequest('GET', '/clock/:9am/a:b/:/:a-b')).toStrictEqual({
            path: '/clock/:9am/a:b/:/:a-b',
        });
        expect(routeRequest('GET', '/users/me', { params: {} })).toStrictEqual({
            path: '/users/me',
            template: '/users/me',
        });
    });

    test('routeRequest — refuses a template handed no params, naming the call to write', () => {
        // Given - a template whose two parameters have no value
        // Then - the four parts, the call written with the parameters
        expect(() => routeRequest('GET', '/events/:id/seats/:seat')).toThrow(
            new TypeError(
                refused(
                    '.get("/events/:id/seats/:seat") names :id, :seat and is handed no params',
                    '.get("/events/:id/seats/:seat", { params: { id: …, seat: … } })',
                ),
            ),
        );
    });

    test('routeRequest — refuses a parameter with no value, a value no parameter takes, or both', () => {
        // Given - params that miss a name, that add one to a path with none, and that do both
        // Then - each named, in one refusal
        expect([
            refusalOf(() => routeRequest('GET', '/events/:id', { params: {} })),
            refusalOf(() => routeRequest('GET', '/users/me', { params: { id: 7 } })),
            refusalOf(() => routeRequest('DELETE', '/events/:id', { params: { eventId: 7 } })),
        ]).toStrictEqual([
            refused(
                '.get("/events/:id", { params }): :id has no value',
                '.get("/events/:id", { params: { id: … } })',
            ),
            refused(
                '.get("/users/me", { params }): `id` is no parameter of it',
                '.get("/users/me", { params: {} })',
            ),
            refused(
                '.delete("/events/:id", { params }): :id has no value, `eventId` is no parameter of it',
                '.delete("/events/:id", { params: { id: … } })',
            ),
        ]);
    });
});
