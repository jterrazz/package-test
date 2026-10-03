import { describe, expect, test } from 'vitest';

import { isStreamBody, STREAM_BODY } from '../exchange.js';
import { http } from './http.js';

const URL = 'https://api.example.com/things';

describe('http', () => {
    test('http — request builders — every verb builds an http request half, and any() wildcards the method', () => {
        // Given - the six request builders
        // Then - each carries its method, the adapter, and the declared url
        expect(
            [
                http.get(URL),
                http.post(URL),
                http.put(URL),
                http.patch(URL),
                http.delete(URL),
                http.any(URL),
            ].map(({ adapter, method, url }) => ({ adapter, method, url })),
        ).toStrictEqual(
            ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', '*'].map((method) => ({
                adapter: 'http',
                method,
                url: URL,
            })),
        );
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
                    'read: docs/17-stubs.md#http--any-url',
                ].join('\n'),
            ),
        );
    });

    test('http — never — never() is a stub required exactly zero times, its reply naming the route', () => {
        // Given - a route the subject must not reach
        const declared = http.never(http.post(URL));

        // Then - the count is the statement, and a subject that reaches it reads why it failed
        expect(declared).toMatchObject({
            required: true,
            response: {
                status: 418,
                body: { error: `@jterrazz/test: POST ${URL} is declared never requested` },
            },
            times: 0,
        });
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

    test('http — streamed responses — a stream and a text reply take their status, type, delay and headers from init, or their defaults', () => {
        // Given - a stream and a text with no init and with a full one, and an event stating its retry
        const init = { contentType: 'text/x', delay: 9, headers: { 'x-a': '1' }, status: 206 };

        // Then - each reply
        expect([
            http.stream(['a']),
            http.stream(['a'], init),
            http.text('t', { status: 201 }),
            http.sse([{ data: 'x', retry: 3000 }]).body,
        ]).toStrictEqual([
            {
                body: {
                    chunks: ['a'],
                    contentType: 'application/octet-stream',
                    delayBetweenChunks: 0,
                    kind: STREAM_BODY,
                },
                headers: undefined,
                status: 200,
            },
            {
                body: {
                    chunks: ['a'],
                    contentType: 'text/x',
                    delayBetweenChunks: 9,
                    kind: STREAM_BODY,
                },
                headers: { 'x-a': '1' },
                status: 206,
            },
            {
                body: 't',
                delay: undefined,
                headers: { 'content-type': 'text/plain; charset=utf-8' },
                status: 201,
            },
            {
                chunks: ['retry: 3000\ndata: x\n\n'],
                contentType: 'text/event-stream',
                delayBetweenChunks: 0,
                kind: STREAM_BODY,
            },
        ]);
    });
});
