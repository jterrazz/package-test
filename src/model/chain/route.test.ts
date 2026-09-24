import { describe, expect, test } from 'vitest';

import { routeRequest } from './route.js';

describe('routeRequest', () => {
    test('fills the template with its params, each value encoded, the query kept', () => {
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

    test('sends a path with no parameter as written, and `{ params: {} }` makes it the template', () => {
        // Given - the same literal path, bare and stated as the route
        // Then - bare, no template is read; stated, the path is its own template
        expect(routeRequest('GET', '/users/me')).toStrictEqual({ path: '/users/me' });
        expect(routeRequest('GET', '/users/me', { params: {} })).toStrictEqual({
            path: '/users/me',
            template: '/users/me',
        });
    });

    test('refuses a template handed no params, naming the call to write', () => {
        // Given - a template whose parameter has no value
        // Then - the four parts, the call written with the parameter
        expect(() => routeRequest('GET', '/events/:id')).toThrow(
            'found: .get("/events/:id") names :id and is handed no params\n' +
                'why: A request written as its route template is handed exactly the parameters the template names.\n' +
                'fix: write .get("/events/:id", { params: { id: … } })\n' +
                'read: docs/19-linting.md#b12-route-params-runtime',
        );
    });

    test('refuses a parameter with no value and a value no parameter takes', () => {
        // Given - params that miss one name and add another
        // Then - both named, in one refusal
        expect(() => routeRequest('DELETE', '/events/:id', { params: { eventId: 7 } })).toThrow(
            'found: .delete("/events/:id", { params }): :id has no value, `eventId` is no parameter of it',
        );
    });
});
