import { describe, expect, test } from 'vitest';

import { http } from '../kinds/http.js';
import { describeRoute, routeKeyOf, routePatternOf, urlMatches } from './route.js';

describe('route', () => {
    test('route — url forms — a path-form url matches any origin, tokens structural, query a subset', () => {
        // Given - a path-form url with a token segment and a query param
        const declared = '/articles/{{uuid}}?locale=fr';
        const article = 'https://app.test/articles/3f2504e0-4f89-41d3-9a0c-0305e82c3301';

        // Then - any origin matches, extra query params are ignored, the token and the declared query still gate
        expect(urlMatches(declared, `${article}?locale=fr&page=2`)).toBe(true);
        expect(urlMatches(declared, 'https://app.test/articles/nope?locale=fr')).toBe(false);
        expect(urlMatches(declared, article)).toBe(false);
    });

    test('route — url forms — a relative observed url (the stub backend) matches a path-form url', () => {
        // Given - the stub backend sees `/events?x=1`, not a full URL
        const observed = '/events?x=1';

        // Then - it matches, and the declared query stays a subset constraint
        expect(urlMatches('/events', observed)).toBe(true);
        expect(urlMatches('/events?x=2', observed)).toBe(false);
    });

    test('route — url forms — an absolute url matches on origin+pathname, ignoring extra query', () => {
        // Given - an absolute url with no query of its own
        const declared = 'https://api.example.com/a';

        // Then - the app may append its own params, never change the path
        expect(urlMatches(declared, `${declared}?lang=en`)).toBe(true);
        expect(urlMatches(declared, 'https://api.example.com/b')).toBe(false);
    });

    test('route — url forms — the pattern a handler listens on is a path form at any origin, an absolute url as written', () => {
        // Given - a path form and an absolute url
        const pattern = routePatternOf('/events/{{uuid}}');

        // Then - the path form becomes a pattern over any origin, the absolute url stays itself
        expect(pattern).toBeInstanceOf(RegExp);
        expect(String(routePatternOf('https://api.example.com/a?x=1'))).toBe(
            'https://api.example.com/a',
        );
    });

    test('route — the name of a route — one key per method and declared url source, spoken as the author wrote it', () => {
        // Given - a string route, its RegExp twin, and a route of any method
        const written = http.get('/events');
        const pattern = http.get(/events/u);
        const any = http.any('/events');

        // Then - the two forms never share a key, and the description reads as the declaration
        expect([routeKeyOf(written), routeKeyOf(pattern)]).toStrictEqual([
            'GET str:/events',
            'GET re:events',
        ]);
        expect([describeRoute(written), describeRoute(pattern), describeRoute(any)]).toStrictEqual([
            'GET /events',
            'GET /events/u',
            'ANY /events',
        ]);
    });

    test('route — the name of a route — names the headers its request must not carry', () => {
        // Given - routes forbidding one header, then two
        const one = http.get('/events', { without: { headers: ['cookie'] } });
        const two = http.get('/events', { without: { headers: ['cookie', 'authorization'] } });

        // Then - the description carries them after the url
        expect([describeRoute(one), describeRoute(two)]).toStrictEqual([
            'GET /events (without header cookie)',
            'GET /events (without headers cookie, authorization)',
        ]);
    });
});
