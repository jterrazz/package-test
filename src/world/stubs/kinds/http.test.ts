import { describe, expect, test } from 'vitest';

import { match } from '../../../expectations/tokens/match.js';
import { isStreamBody, STREAM_BODY } from '../exchange.js';
import type { MatchableRequest } from '../exchange.js';
import { http } from './http.js';

const URL = 'https://api.example.com/things';

function request(overrides: Partial<MatchableRequest> = {}): MatchableRequest {
    return { body: null, headers: {}, method: 'POST', url: URL, ...overrides };
}

describe('http', () => {
    test('http — request builders — every verb builds an http request half, and any() wildcards the method', () => {
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

    test('http — request builders — leaves match undefined so any url/method request fires', () => {
        // Given - a bare request half
        const declared = http.post(URL);

        // Then - there is no request-level matcher
        expect(declared.match).toBeUndefined();
    });

    test('http — response builders — json defaults to 200 and takes status, headers, and delay from init', () => {
        // Given - a bare and a configured json response
        // Then - the init options land on the response envelope
        expect(http.json({ ok: true })).toStrictEqual({
            status: 200,
            body: { ok: true },
            delay: undefined,
            headers: undefined,
        });
        expect(
            http.json({ ok: true }, { delay: 50, headers: { etag: 'w/1' }, status: 201 }),
        ).toStrictEqual({ status: 201, body: { ok: true }, delay: 50, headers: { etag: 'w/1' } });
    });

    test('http — response builders — text serves a plain-text body', () => {
        // Given - a text response
        const response = http.text('hello');

        // Then - the content type says text, and the body stays a string
        expect(response.body).toBe('hello');
        expect(response.headers?.['content-type']).toBe('text/plain; charset=utf-8');
    });

    test('http — response builders — error defaults its body and accepts an explicit one', () => {
        // Given - an error with and without a body
        // Then - the default body names the status; an explicit body is served as-is
        expect(http.error(500)).toStrictEqual({ status: 500, body: { error: 'HTTP 500' } });
        expect(http.error(404, { code: 'gone' })).toStrictEqual({
            status: 404,
            body: { code: 'gone' },
        });
    });

    test('http — response builders — empty is a body-less 204 by default', () => {
        // Given - the empty response builder
        // Then - no body, and the status is overridable
        expect(http.empty()).toStrictEqual({ status: 204, body: null });
        expect(http.empty(202).status).toBe(202);
    });

    test('http — body filter — object body is a deep SUBSET match; extra keys are ignored', () => {
        // Given - a filter on a nested subset of the body
        const declared = http.post(URL, { body: { user: { role: 'admin' } } });

        // Then - a superset body matches, a diverging one does not
        expect(
            declared.match!(request({ body: { extra: 1, user: { id: 7, role: 'admin' } } })),
        ).toBe(true);
        expect(declared.match!(request({ body: { user: { role: 'guest' } } }))).toBe(false);
    });

    test('http — body filter — object body accepts match.* matchers as leaf values', () => {
        // Given - a subset filter whose leaf is a dynamic matcher
        const declared = http.post(URL, { body: { id: match.uuid() } });

        // Then - only a well-formed UUID leaf passes
        expect(
            declared.match!(request({ body: { id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301' } })),
        ).toBe(true);
        expect(declared.match!(request({ body: { id: 'not-a-uuid' } }))).toBe(false);
    });

    test('http — body filter — string body is a containment test over the raw text body', () => {
        // Given - a substring filter
        const declared = http.post(URL, { body: 'needle' });

        // Then - raw text containing the needle passes
        expect(declared.match!(request({ body: 'a haystack with a needle inside' }))).toBe(true);
        expect(declared.match!(request({ body: 'nothing here' }))).toBe(false);
    });

    test('http — body filter — string body containment also spans a stringified JSON body', () => {
        // Given - a filter that looks for a value serialized in the body
        const declared = http.post(URL, { body: 'alice' });

        // Then - the JSON body is stringified before the containment test
        expect(declared.match!(request({ body: { user: 'alice' } }))).toBe(true);
    });

    test('http — body filter — a RegExp body tests the raw text body', () => {
        // Given - a pattern filter
        const declared = http.post(URL, { body: /order-\d+/u });

        // Then - only a matching body passes
        expect(declared.match!(request({ body: 'order-42 placed' }))).toBe(true);
        expect(declared.match!(request({ body: 'order-none' }))).toBe(false);
    });

    test('http — header filter — header names are case-insensitive; string is exact, RegExp tests', () => {
        // Given - a header subset filter mixing string and RegExp
        const declared = http.get(URL, {
            headers: { Authorization: /^Bearer /u, 'X-Env': 'prod' },
        });

        // Then - a superset of headers with the right values matches
        expect(
            declared.match!(
                request({
                    headers: { authorization: 'Bearer abc', 'x-env': 'prod', 'x-extra': '1' },
                }),
            ),
        ).toBe(true);

        expect(
            declared.match!(request({ headers: { authorization: 'Basic abc', 'x-env': 'prod' } })),
        ).toBe(false);
        expect(declared.match!(request({ headers: { 'x-env': 'prod' } }))).toBe(false);
    });

    test('http — absent-header filter — without.headers names what the request must not carry, case-insensitively', () => {
        // Given - a filter forbidding a header, written in mixed case
        const declared = http.get(URL, { without: { headers: ['Set-Cookie', 'x-debug'] } });

        // Then - the names are kept lowercased, as observed headers are keyed
        expect(declared.absentHeaders).toStrictEqual(['set-cookie', 'x-debug']);
        expect(http.get(URL, { without: { headers: [] } }).absentHeaders).toBeUndefined();
    });

    test('http — absent-header filter — a header both required and forbidden is refused at declaration', () => {
        // Given - a filter that requires a header and forbids it
        const filter = { headers: { 'X-Tenant': 'acme' }, without: { headers: ['x-tenant'] } };
        const declare = (): unknown => http.get(URL, filter);

        // Then - the refusal names the header and routes to the filter's section
        expect(declare).toThrow(
            new Error(
                [
                    'found: an http stub filter that both requires and forbids the header(s) x-tenant',
                    'why: A header both required and absent matches no request, so the stub could never fire.',
                    'fix: state x-tenant in `headers` or in `without.headers`, never both',
                    'read: docs/16-stubs.md#http--any-url',
                ].join('\n'),
            ),
        );
    });

    test('http — query filter — matches a subset of URL search params; string exact, RegExp tests', () => {
        // Given - a query subset filter
        const declared = http.get(URL, { query: { page: /^\d+$/u, tag: 'news' } });

        // Then - a URL whose params satisfy the subset matches
        expect(declared.match!(request({ url: `${URL}?tag=news&page=3&sort=desc` }))).toBe(true);

        expect(declared.match!(request({ url: `${URL}?tag=sports&page=3` }))).toBe(false);
        expect(declared.match!(request({ url: `${URL}?page=3` }))).toBe(false);
    });

    test('http — query filter — a relative observed url still exposes its query params', () => {
        // Given - the stub backend's origin-relative url
        const declared = http.get('/articles', { query: { locale: 'fr' } });

        // Then - the filter reads the params off the path form
        expect(declared.match!(request({ url: '/articles?locale=fr' }))).toBe(true);
        expect(declared.match!(request({ url: '/articles?locale=en' }))).toBe(false);
    });

    test('http — combined filter — every provided facet must match', () => {
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

    test('http — responses — unreachable() is a transport failure, not a status', () => {
        // Given - the collection declared unreachable
        const response = http.unreachable();

        // Then - nothing is served: the request itself fails, as it does when nothing is listening. A 503 would test the other branch entirely.
        expect(response).toStrictEqual({ body: null, transport: 'network-error' });
    });

    test('http — responses — error() still answers with a status, which unreachable() never does', () => {
        // Given - the two ways a call can go wrong
        // Then - one has a reply and the other has none
        expect(http.error(503).status).toBe(503);
        expect(http.unreachable().status).toBeUndefined();
    });

    test('http — streamed responses — stream() keeps the pieces and their order, never a serialised value', () => {
        // Given - a reply declared as three pieces
        const response = http.stream(['Hel', 'lo, ', 'world'], {
            contentType: 'text/plain',
            delay: 5,
        });

        // Then - the body is a tagged stream the adapters recognise, not an object
        expect(isStreamBody(response.body)).toBe(true);
        expect(response.body).toStrictEqual({
            chunks: ['Hel', 'lo, ', 'world'],
            contentType: 'text/plain',
            delayBetweenChunks: 5,
            kind: STREAM_BODY,
        });
    });

    test('http — streamed responses — sse() frames one chunk per event, as an EventSource reads them', () => {
        // Given - a named event, a JSON payload and a plain one
        const response = http.sse([
            { data: { token: 'Hel' } },
            { data: { token: 'lo' }, event: 'token', id: '2' },
            { data: '', event: 'done' },
        ]);

        // Then - each event is its own chunk, in the wire form
        expect(response.body).toMatchObject({
            chunks: [
                'data: {"token":"Hel"}\n\n',
                'event: token\nid: 2\ndata: {"token":"lo"}\n\n',
                'event: done\ndata: \n\n',
            ],
            contentType: 'text/event-stream',
        });
    });

    test('http — streamed responses — sse() splits a multi-line payload into one data line each', () => {
        // Given - an event whose payload carries a newline
        const response = http.sse([{ data: 'first\nsecond' }]);

        // Then - the frame stays one event: a raw newline would end it
        expect(response.body).toMatchObject({
            chunks: ['data: first\ndata: second\n\n'],
        });
    });
});
