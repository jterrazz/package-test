import { describe, expect, test } from 'vitest';

import {
    exchangeMatches,
    type ExchangeRequest,
    interceptEntriesOf,
    type ObservedExchangeRequest,
    parseInterceptFile,
} from './intercept-file.js';

const TWO_EXCHANGES = [
    '### two events, then their articles',
    '',
    'GET /events',
    '',
    'HTTP/1.1 200 OK',
    'content-type: application/json',
    '',
    '{ "items": [ { "id": 1 } ] }',
    '',
    '###',
    '',
    'GET /articles?event_id=00000000-0000-4000-8000-000000000001',
    '',
    'HTTP/1.1 200 OK',
    'content-type: application/json',
    '',
    '{ "items": [] }',
    '',
].join('\n');

function observed(overrides: Partial<ObservedExchangeRequest>): ObservedExchangeRequest {
    return { headers: {}, method: 'GET', url: '/events', ...overrides };
}

describe('http-files — intercept files (parsing)', () => {
    test('parses ###-separated exchanges into request/response pairs', () => {
        // Given - a bi-block file with two exchanges
        const exchanges = parseInterceptFile(TWO_EXCHANGES, 'intercepts/two-events.http');

        // Then - every half of every exchange is extracted
        expect(exchanges).toHaveLength(2);
        expect(exchanges[0].request.method).toBe('GET');
        expect(exchanges[0].request.path).toBe('/events');
        expect(exchanges[0].response.status).toBe(200);
        expect(exchanges[0].response.body).toEqual({ items: [{ id: 1 }] });
        expect(exchanges[1].request.path).toBe(
            '/articles?event_id=00000000-0000-4000-8000-000000000001',
        );
        expect(exchanges[1].response.headers).toEqual({ 'content-type': 'application/json' });
    });

    test('parses a leading exchange without a ### opener', () => {
        // Given - a single exchange with no section marker
        const exchanges = parseInterceptFile(
            'GET /ping\n\nHTTP/1.1 204 No Content\n',
            'intercepts/ping.http',
        );

        // Then - the file is one exchange with a body-less response
        expect(exchanges).toHaveLength(1);
        expect(exchanges[0].response.status).toBe(204);
        expect(exchanges[0].response.hasBody).toBe(false);
    });

    test('parses declared request headers', () => {
        // Given - a request block carrying a header
        const exchanges = parseInterceptFile(
            'GET /me\nauthorization: Bearer abc\n\nHTTP/1.1 200 OK\n\n{ "id": 1 }\n',
            'intercepts/me.http',
        );

        // Then - the header joins the declared subset
        expect(exchanges[0].request.headers).toEqual({ authorization: 'Bearer abc' });
    });

    test('rejects an exchange with no response block', () => {
        // Given - a request with no HTTP/1.1 status line after it
        // Then - the error names the exchange and the expected shape
        expect(() => parseInterceptFile('GET /events\n', 'intercepts/bad.http')).toThrow(
            'intercepts/bad.http: exchange 1 has no response block — expected an "HTTP/1.1 <status>" line after the request',
        );
    });

    test('rejects a request block that declares a body', () => {
        // Given - a request half carrying a body before the response half
        const content = 'POST /events\n\n{ "nope": true }\n\nHTTP/1.1 201 Created\n';

        // Then - the matching surface is named
        expect(() => parseInterceptFile(content, 'intercepts/body.http')).toThrow(
            'intercepts/body.http: exchange 1 declares a request body — matching is method + path + headers only',
        );
    });

    test('rejects a non-numeric status', () => {
        // Given - a {{number}} status (an expectation token, not a stub reply)
        const content = 'GET /events\n\nHTTP/1.1 {{number}}\n';

        // Then - the error explains why tokens have no place here
        expect(() => parseInterceptFile(content, 'intercepts/token.http')).toThrow(
            'intercepts/token.http: exchange 1 has a non-numeric status "{{number}}"',
        );
    });

    test('rejects an empty file', () => {
        // Given - a file with no exchanges at all
        // Then - the shape of the format is spelled out
        expect(() => parseInterceptFile('\n###\n\n', 'intercepts/empty.http')).toThrow(
            'intercepts/empty.http: no exchanges found — expected "###"-separated request/response pairs',
        );
    });
});

describe('http-files — intercept files (matching)', () => {
    const declared: ExchangeRequest = { headers: {}, method: 'GET', path: '/events' };

    test('matches method + pathname on a path-only and on a full URL', () => {
        // Given - the declared GET /events
        // Then - origin-relative and absolute observed URLs both match
        expect(exchangeMatches(declared, observed({ url: '/events' }))).toBe(true);
        expect(exchangeMatches(declared, observed({ url: 'https://api.test/events' }))).toBe(true);
    });

    test('method and pathname are exact', () => {
        // Given - the declared GET /events
        // Then - a different method or pathname refuses
        expect(exchangeMatches(declared, observed({ method: 'POST' }))).toBe(false);
        expect(exchangeMatches(declared, observed({ url: '/events/1' }))).toBe(false);
        expect(exchangeMatches(declared, observed({ url: '/event' }))).toBe(false);
    });

    test('declared query params subset-match — extra observed params are ignored', () => {
        // Given - a declared query param
        const withQuery: ExchangeRequest = {
            headers: {},
            method: 'GET',
            path: '/articles?event_id=e-1',
        };

        // Then - the app may add extras (locale), but the declared one must match
        expect(
            exchangeMatches(withQuery, observed({ url: '/articles?event_id=e-1&locale=fr' })),
        ).toBe(true);
        expect(exchangeMatches(withQuery, observed({ url: '/articles?event_id=e-2' }))).toBe(false);
        expect(exchangeMatches(withQuery, observed({ url: '/articles' }))).toBe(false);
    });

    test('declared headers subset-match, names case-insensitive', () => {
        // Given - a declared Authorization header
        const withHeader: ExchangeRequest = {
            headers: { Authorization: 'Bearer abc' },
            method: 'GET',
            path: '/me',
        };

        // Then - the observed lowercased header satisfies it; absence refuses
        expect(
            exchangeMatches(
                withHeader,
                observed({ headers: { authorization: 'Bearer abc' }, url: '/me' }),
            ),
        ).toBe(true);
        expect(exchangeMatches(withHeader, observed({ url: '/me' }))).toBe(false);
    });

    test('a {{token}} path segment matches structurally', () => {
        // Given - a tokenized declared path
        const tokenized: ExchangeRequest = {
            headers: {},
            method: 'GET',
            path: '/articles/{{uuid}}',
        };

        // Then - a real uuid matches, a non-uuid segment refuses
        expect(
            exchangeMatches(
                tokenized,
                observed({ url: '/articles/00000000-0000-4000-8000-000000000001' }),
            ),
        ).toBe(true);
        expect(exchangeMatches(tokenized, observed({ url: '/articles/latest' }))).toBe(false);
    });

    test('a {{token}} query value matches structurally', () => {
        // Given - a tokenized declared query param
        const tokenized: ExchangeRequest = {
            headers: {},
            method: 'GET',
            path: '/articles?event_id={{uuid}}',
        };

        // Then - any uuid value satisfies the declared param
        expect(
            exchangeMatches(
                tokenized,
                observed({ url: '/articles?event_id=00000000-0000-4000-8000-000000000001' }),
            ),
        ).toBe(true);
        expect(exchangeMatches(tokenized, observed({ url: '/articles?event_id=42' }))).toBe(false);
    });
});

describe('http-files — intercept files (MSW entries)', () => {
    test('converts exchanges into any-origin generic-http entries', () => {
        // Given - the parsed example file
        const entries = interceptEntriesOf(
            parseInterceptFile(TWO_EXCHANGES, 'intercepts/two-events.http'),
        );

        // Then - triggers route the declared pathname on any origin
        expect(entries).toHaveLength(2);
        expect(entries[0].trigger.adapter).toBe('http');
        expect(entries[0].trigger.method).toBe('GET');
        const url = entries[0].trigger.url as RegExp;
        expect(url.test('https://api.example.com/events')).toBe(true);
        expect(url.test('http://127.0.0.1:4000/events?locale=fr')).toBe(true);
        expect(url.test('https://api.example.com/articles')).toBe(false);
    });

    test('the match predicate enforces the declared query subset', () => {
        // Given - the second exchange (a declared event_id)
        const entries = interceptEntriesOf(
            parseInterceptFile(TWO_EXCHANGES, 'intercepts/two-events.http'),
        );
        const match = entries[1].trigger.match!;

        // Then - only a request carrying the declared param value matches
        expect(
            match({
                body: null,
                headers: {},
                url: 'https://api.test/articles?event_id=00000000-0000-4000-8000-000000000001',
            }),
        ).toBe(true);
        expect(
            match({ body: null, headers: {}, url: 'https://api.test/articles?event_id=other' }),
        ).toBe(false);
    });

    test('the response carries the declared status, headers, and body', () => {
        // Given - a declared 404 with a header
        const entries = interceptEntriesOf(
            parseInterceptFile(
                'GET /missing\n\nHTTP/1.1 404 Not Found\nx-reason: gone\n\n{ "error": "gone" }\n',
                'intercepts/missing.http',
            ),
        );

        // Then - the entry replies exactly what the file declared
        expect(entries[0].response).toEqual({
            body: { error: 'gone' },
            headers: { 'x-reason': 'gone' },
            status: 404,
        });
    });
});
