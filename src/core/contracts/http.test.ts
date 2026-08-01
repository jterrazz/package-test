import { describe, expect, test } from 'vitest';

import { match } from '../matching/match.js';
import { http } from './http.js';
import type { MatchableRequest } from './types.js';

const URL = 'https://api.example.com/things';

function request(overrides: Partial<MatchableRequest> = {}): MatchableRequest {
    return { body: null, headers: {}, method: 'POST', url: URL, ...overrides };
}

describe('http — request builders', () => {
    test('every verb builds an http request half, and any() wildcards the method', () => {
        // Given - the six request builders
        // Then - each carries its method, the adapter, and the declared url
        expect(http.get(URL).method).toBe('GET');
        expect(http.post(URL).method).toBe('POST');
        expect(http.put(URL).method).toBe('PUT');
        expect(http.patch(URL).method).toBe('PATCH');
        expect(http.delete(URL).method).toBe('DELETE');
        expect(http.any(URL).method).toBe('*');
        expect(http.get(URL).adapter).toBe('http');
        expect(http.get('/articles/{{uuid}}').url).toBe('/articles/{{uuid}}');
    });

    test('leaves match undefined so any url/method request fires', () => {
        // Given - a bare request half
        const declared = http.post(URL);

        // Then - there is no request-level matcher
        expect(declared.match).toBeUndefined();
    });
});

describe('http — response builders', () => {
    test('json defaults to 200 and takes status, headers, and delay from init', () => {
        // Given - a bare and a configured json response
        // Then - the init options land on the response envelope
        expect(http.json({ ok: true })).toEqual({
            status: 200,
            body: { ok: true },
            delay: undefined,
            headers: undefined,
        });
        expect(
            http.json({ ok: true }, { delay: 50, headers: { etag: 'w/1' }, status: 201 }),
        ).toEqual({ status: 201, body: { ok: true }, delay: 50, headers: { etag: 'w/1' } });
    });

    test('text serves a plain-text body', () => {
        // Given - a text response
        const response = http.text('hello');

        // Then - the content type says text, and the body stays a string
        expect(response.body).toBe('hello');
        expect(response.headers?.['content-type']).toBe('text/plain; charset=utf-8');
    });

    test('error defaults its body and accepts an explicit one', () => {
        // Given - an error with and without a body
        // Then - the default body names the status; an explicit body is served as-is
        expect(http.error(500)).toEqual({ status: 500, body: { error: 'HTTP 500' } });
        expect(http.error(404, { code: 'gone' })).toEqual({ status: 404, body: { code: 'gone' } });
    });

    test('empty is a body-less 204 by default', () => {
        // Given - the empty response builder
        // Then - no body, and the status is overridable
        expect(http.empty()).toEqual({ status: 204, body: null });
        expect(http.empty(202).status).toBe(202);
    });
});

describe('http — body filter', () => {
    test('object body is a deep SUBSET match; extra keys are ignored', () => {
        // Given - a filter on a nested subset of the body
        const declared = http.post(URL, { body: { user: { role: 'admin' } } });

        // Then - a superset body matches, a diverging one does not
        expect(
            declared.match!(request({ body: { extra: 1, user: { id: 7, role: 'admin' } } })),
        ).toBe(true);
        expect(declared.match!(request({ body: { user: { role: 'guest' } } }))).toBe(false);
    });

    test('object body accepts match.* matchers as leaf values', () => {
        // Given - a subset filter whose leaf is a dynamic matcher
        const declared = http.post(URL, { body: { id: match.uuid() } });

        // Then - only a well-formed UUID leaf passes
        expect(
            declared.match!(request({ body: { id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301' } })),
        ).toBe(true);
        expect(declared.match!(request({ body: { id: 'not-a-uuid' } }))).toBe(false);
    });

    test('string body is a containment test over the raw text body', () => {
        // Given - a substring filter
        const declared = http.post(URL, { body: 'needle' });

        // Then - raw text containing the needle passes
        expect(declared.match!(request({ body: 'a haystack with a needle inside' }))).toBe(true);
        expect(declared.match!(request({ body: 'nothing here' }))).toBe(false);
    });

    test('string body containment also spans a stringified JSON body', () => {
        // Given - a filter that looks for a value serialized in the body
        const declared = http.post(URL, { body: 'alice' });

        // Then - the JSON body is stringified before the containment test
        expect(declared.match!(request({ body: { user: 'alice' } }))).toBe(true);
    });

    test('a RegExp body tests the raw text body', () => {
        // Given - a pattern filter
        const declared = http.post(URL, { body: /order-\d+/ });

        // Then - only a matching body passes
        expect(declared.match!(request({ body: 'order-42 placed' }))).toBe(true);
        expect(declared.match!(request({ body: 'order-none' }))).toBe(false);
    });
});

describe('http — header filter', () => {
    test('header names are case-insensitive; string is exact, RegExp tests', () => {
        // Given - a header subset filter mixing string and RegExp
        const declared = http.get(URL, {
            headers: { Authorization: /^Bearer /, 'X-Env': 'prod' },
        });

        // Then - a superset of headers with the right values matches
        expect(
            declared.match!(
                request({
                    headers: { authorization: 'Bearer abc', 'x-env': 'prod', 'x-extra': '1' },
                }),
            ),
        ).toBe(true);

        // And - a wrong value or a missing header fails
        expect(
            declared.match!(request({ headers: { authorization: 'Basic abc', 'x-env': 'prod' } })),
        ).toBe(false);
        expect(declared.match!(request({ headers: { 'x-env': 'prod' } }))).toBe(false);
    });
});

describe('http — query filter', () => {
    test('matches a subset of URL search params; string exact, RegExp tests', () => {
        // Given - a query subset filter
        const declared = http.get(URL, { query: { page: /^\d+$/, tag: 'news' } });

        // Then - a URL whose params satisfy the subset matches
        expect(declared.match!(request({ url: `${URL}?tag=news&page=3&sort=desc` }))).toBe(true);

        // And - a wrong or missing param fails
        expect(declared.match!(request({ url: `${URL}?tag=sports&page=3` }))).toBe(false);
        expect(declared.match!(request({ url: `${URL}?page=3` }))).toBe(false);
    });

    test('a relative observed url still exposes its query params', () => {
        // Given - the stub backend's origin-relative url
        const declared = http.get('/articles', { query: { locale: 'fr' } });

        // Then - the filter reads the params off the path form
        expect(declared.match!(request({ url: '/articles?locale=fr' }))).toBe(true);
        expect(declared.match!(request({ url: '/articles?locale=en' }))).toBe(false);
    });
});

describe('http — combined filter', () => {
    test('every provided facet must match', () => {
        // Given - a filter across body, headers, and query
        const declared = http.post(URL, {
            body: { action: 'create' },
            headers: { 'content-type': 'application/json' },
            query: { v: '2' },
        });

        // Then - all three must hold
        expect(
            declared.match!(
                request({
                    body: { action: 'create', payload: {} },
                    headers: { 'content-type': 'application/json' },
                    url: `${URL}?v=2`,
                }),
            ),
        ).toBe(true);

        // And - a single failing facet rejects the request
        expect(
            declared.match!(
                request({
                    body: { action: 'create' },
                    headers: { 'content-type': 'application/json' },
                    url: `${URL}?v=3`,
                }),
            ),
        ).toBe(false);
    });
});
