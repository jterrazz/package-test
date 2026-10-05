import { describe, expect, onTestFinished, test } from 'vitest';

import { http } from '../../kinds/http.js';
import {
    fetchJson,
    get,
    heldRequest,
    replyOf,
    started,
    statusOf,
    stopsWithin,
} from './stub-backend.fixtures.js';
import { StubBackend } from './stub-backend.js';

describe('StubBackend', () => {
    test('stub backend — streamed replies — writes the pieces in order and closes after the last one', async () => {
        // Given - a route declared as three pieces of text
        const { url } = await started([
            {
                request: http.get('/tokens'),
                response: http.stream(['Hel', 'lo, ', 'world'], { contentType: 'text/plain' }),
            },
        ]);

        // When - the app reads the reply to its end
        const response = await fetch(`${url}/tokens`);

        // Then - it read the declared order, under the declared content type
        expect(response.headers.get('content-type')).toBe('text/plain');
        await expect(response.text()).resolves.toBe('Hello, world');
    });

    test('stub backend — streamed replies — serves an event stream as text/event-stream', async () => {
        // Given - two server-sent events declared on one route
        const { url } = await started([
            {
                request: http.get('/feed'),
                response: http.sse([{ data: { token: 'a' } }, { data: { token: 'b' } }]),
            },
        ]);

        // Then - the frames arrive in the wire form, under the SSE type
        const response = await fetch(`${url}/feed`);
        expect(response.headers.get('content-type')).toBe('text/event-stream');
        await expect(response.text()).resolves.toBe(
            'data: {"token":"a"}\n\ndata: {"token":"b"}\n\n',
        );
    });

    test('stub backend — serving declared stubs — a stub without times keeps replying; times plays a sequence', async () => {
        // Given - a finite failure before an unlimited success on the same route
        const { url } = await started([
            { request: http.get('/events'), response: http.json({ n: 1 }), times: 1 },
            get('/events', { n: 2 }),
        ]);

        // Then - first the finite one, then the tail — for every re-render
        await expect(fetchJson(`${url}/events`)).resolves.toStrictEqual({ n: 1 });
        await expect(fetchJson(`${url}/events`)).resolves.toStrictEqual({ n: 2 });
        await expect(fetchJson(`${url}/events`)).resolves.toStrictEqual({ n: 2 });
    });

    test('stub backend — serving declared stubs — a declared query matches as a subset, and a token segment structurally', async () => {
        // Given - a route declared with one query param, and one with a uuid segment
        const { url } = await started([
            get('/articles?event_id=e-1', { items: [1] }),
            get('/articles/{{uuid}}', { title: 'one' }),
        ]);

        // Then - an extra param still matches, any uuid matches, a non-uuid does not
        await expect(fetchJson(`${url}/articles?event_id=e-1&locale=fr`)).resolves.toStrictEqual({
            items: [1],
        });
        await expect(
            fetchJson(`${url}/articles/3f2504e0-4f89-41d3-9a0c-0305e82c3301`),
        ).resolves.toStrictEqual({ title: 'one' });
        await expect(statusOf(`${url}/articles/not-a-uuid`)).resolves.toBe(501);
    });

    test('stub backend — serving declared stubs — the request body reaches match predicates and body filters', async () => {
        // Given - two stubs on one route, routed by the posted body
        const { url } = await started([
            {
                request: http.post('/search', { body: { term: 'bitcoin' } }),
                response: http.json({ hits: 1 }),
            },
            { request: http.post('/search'), response: http.json({ hits: 0 }) },
        ]);

        // When - the app posts each body
        const search = async (term: string): Promise<unknown> =>
            await fetchJson(`${url}/search`, {
                body: JSON.stringify({ term }),
                headers: { 'content-type': 'application/json' },
                method: 'POST',
            });

        // Then - the body-filtered stub answered the first, the bare one the second
        expect([await search('bitcoin'), await search('other')]).toStrictEqual([
            { hits: 1 },
            { hits: 0 },
        ]);
    });

    test('stub backend — transport failures — an unreachable stub drops the connection instead of answering', async () => {
        // Given - a route declared unreachable
        const { url } = await started([
            { request: http.get('/down'), response: http.unreachable() },
        ]);

        // Then - the client's fetch fails in transport, with no status to read
        await expect(fetch(`${url}/down`)).rejects.toThrow(TypeError);
    });

    test('stub backend — strictness (the external-block analog) — violation() also reports a required stub that was never requested', async () => {
        // Given - a chain declaring a route it claims MUST be called
        const { backend, url } = await started([
            get('/events', {}),
            get('/indicators?range=1M', {}, { required: true }),
        ]);
        await fetch(`${url}/events`);

        // Then - the honest failure: the screen never asked for the range
        const violation = backend.violation();
        expect(violation?.message).toContain(
            '- GET /indicators?range=1M — declared and required but never requested',
        );
    });

    test('stub backend — strictness (the external-block analog) — beginChain resets the queue and the unmatched log', async () => {
        // Given - a first chain that served its stub and recorded a miss
        const { backend, url } = await started([get('/events', { n: 1 })]);
        await fetch(`${url}/events`);
        await fetch(`${url}/miss`);
        expect(backend.violation()).toBeInstanceOf(Error);

        // When - the next chain arms the stub afresh
        backend.beginChain([get('/events', { n: 2 })]);

        // Then - the previous chain's state is gone
        expect(backend.violation()).toBeNull();
        await expect(fetchJson(`${url}/events`)).resolves.toStrictEqual({ n: 2 });
    });

    test('stub backend — serving declared stubs — a responder reads the body and headers as observed: nothing sent is null, text is text, a repeated header is no value', async () => {
        // Given - a responder echoing what it observed
        const { url } = await started([
            {
                request: http.post('/echo'),
                response: (request) =>
                    http.json({
                        body: request.body,
                        cookie: request.headers['set-cookie'] ?? null,
                        token: request.headers['x-token'],
                    }),
            },
        ]);
        const echo = async (init: RequestInit): Promise<unknown> =>
            await fetchJson(`${url}/echo`, { method: 'POST', ...init });

        // Then - each body and header as the stub read it
        expect([
            await echo({ body: JSON.stringify({ a: 1 }), headers: { 'X-Token': 'a' } }),
            await echo({ body: 'plain text', headers: { 'x-token': 'b' } }),
            await echo({
                headers: [
                    ['set-cookie', 'a=1'],
                    ['set-cookie', 'b=2'],
                    ['x-token', 'c'],
                ],
            }),
        ]).toStrictEqual([
            { body: { a: 1 }, cookie: null, token: 'a' },
            { body: 'plain text', cookie: null, token: 'b' },
            { body: null, cookie: null, token: 'c' },
        ]);
    });

    test('stub backend — serving declared stubs — a delayed reply lands after an immediate one sent later', async () => {
        // Given - a slow route and a fast one
        const { url } = await started([
            { request: http.get('/slow'), response: http.json({ n: 'slow' }, { delay: 200 }) },
            get('/fast', { n: 'fast' }),
        ]);

        // When - the slow one is asked first, then the fast one
        const landed: string[] = [];
        await Promise.all(
            ['slow', 'fast'].map(async (path) => {
                await fetch(`${url}/${path}`);
                landed.push(path);
            }),
        );

        // Then - the fast one landed first
        expect(landed).toStrictEqual(['fast', 'slow']);
    });

    test('stub backend — serving declared stubs — each reply carries the cors headers and its content type: none without a body, text for text, JSON for a value or a miss', async () => {
        // Given - an empty reply, a reply with no body at all, a text and a value
        const { url } = await started([
            { request: http.delete('/events/1'), response: http.empty() },
            { request: http.get('/bare'), response: { body: undefined, status: 202 } },
            { request: http.get('/block.txt'), response: { body: 'anchored' } },
            get('/value', { a: 1 }),
        ]);

        // Then - each response, and a preflight that asked for no headers
        const preflight = await fetch(`${url}/events/1`, { method: 'OPTIONS' });
        const asked = await fetch(`${url}/anything`, {
            headers: { 'access-control-request-headers': 'x-custom' },
            method: 'OPTIONS',
        });
        expect([
            await replyOf(`${url}/events/1`, 'DELETE'),
            await replyOf(`${url}/bare`),
            await replyOf(`${url}/block.txt`),
            await replyOf(`${url}/value`),
            await replyOf(`${url}/missing?x=1`),
            [
                preflight.status,
                preflight.headers.get('access-control-allow-headers'),
                preflight.headers.get('access-control-max-age'),
                asked.headers.get('access-control-allow-headers'),
            ],
        ]).toStrictEqual([
            [204, '*', null, ''],
            [202, '*', null, ''],
            [200, '*', 'text/plain; charset=utf-8', 'anchored'],
            [200, '*', 'application/json', '{"a":1}'],
            [
                501,
                '*',
                'application/json',
                JSON.stringify({
                    declared: ['DELETE /events/1', 'GET /bare', 'GET /block.txt', 'GET /value'],
                    error: '@jterrazz/test declared backend: no stub matches GET /missing?x=1',
                }),
            ],
            [204, '*', '600', 'x-custom'],
        ]);
    });

    test('stub backend — strictness (the external-block analog) — before any chain and in a chain of no stub the backend is unguarded, and armed its violation names each miss and its count', async () => {
        // Given - a backend no chain armed, then a chain declaring one route that sees two misses
        const backend = new StubBackend();
        onTestFinished(async () => {
            await backend.stop();
        });
        const url = await backend.start();
        const unarmed = [await statusOf(`${url}/early`), backend.violation()];
        backend.beginChain([]);
        await fetch(`${url}/early`);
        unarmed.push(backend.violation());
        backend.beginChain([get('/events', {}), get('/users', {})]);
        await fetch(`${url}/a`);
        await fetch(`${url}/a`);
        await fetch(`${url}/b`, { method: 'PUT' });

        // Then - unarmed it answers and stays quiet; armed, the whole refusal
        expect([unarmed, backend.violation()?.message]).toStrictEqual([
            [501, null, null],
            [
                'found: unmatched request(s) hit the declared backend during the chain:',
                '  - GET /a (2 times)',
                '  - PUT /b',
                'declared stubs:',
                '  - GET /events',
                '  - GET /users',
                'why: From its first stub, a chain’s network is strict: every outgoing request matches a declared stub.',
                "fix: add a stub for each to the chain's composite",
                'read: docs/reference/linting.md#network-strict-after-first-stub',
            ].join('\n'),
        ]);
    });

    test('stub backend — the server — a fixed port is the port it listens on, a port taken refuses the start, and stopping ends a connection still waiting on its reply', async () => {
        // Given - a backend on a port of its own, then a client its reply keeps waiting
        const first = new StubBackend();
        onTestFinished(async () => {
            await first.stop();
        });
        const url = await first.start();
        const port = Number(new URL(url).port);
        const second = new StubBackend({ port });
        const third = new StubBackend({ port });
        await first.stop();
        onTestFinished(async () => {
            await second.stop();
        });

        // Then - the second takes that port, the third finds it taken, and the second stops past a held request
        await expect(second.start()).resolves.toBe(`http://127.0.0.1:${port}`);
        await expect(third.start()).rejects.toThrow('EADDRINUSE');
        await heldRequest(second, `http://127.0.0.1:${port}`);
        await expect(stopsWithin(second, 2000)).resolves.toBe(true);
    });
});
