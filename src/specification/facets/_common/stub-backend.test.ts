import { afterEach, describe, expect, test } from 'vitest';

import type { Contract } from '../../contracts/contract.js';
import { http } from '../../contracts/http.js';
import { StubBackend } from './stub-backend.js';

// ── Fakes — contracts built inline (mocks are code, CONVENTIONS I4) ──

function get(path: string, body: unknown, extra: Partial<Contract> = {}): Contract {
    return { request: http.get(path), response: http.json(body), ...extra };
}

let backend: null | StubBackend = null;

afterEach(async () => {
    await backend?.stop();
    backend = null;
});

async function started(contracts: Contract[]): Promise<string> {
    backend = new StubBackend();
    const url = await backend.start();
    backend.beginChain(contracts);
    return url;
}

async function fetchJson(url: string): Promise<unknown> {
    const response = await fetch(url);
    return await response.json();
}

describe('stub backend — streamed replies', () => {
    test('writes the pieces in order and closes after the last one', async () => {
        // Given - a route declared as three pieces of text
        const url = await started([
            {
                request: http.get('/tokens'),
                response: http.stream(['Hel', 'lo, ', 'world'], { contentType: 'text/plain' }),
            },
        ]);

        // When - the app reads the reply as it lands
        const response = await fetch(`${url}/tokens`);
        const decoder = new TextDecoder();
        const seen = await Array.fromAsync(response.body ?? [], (piece: Uint8Array) =>
            decoder.decode(piece),
        );

        // Then - it read the declared order, under the declared content type
        expect(response.headers.get('content-type')).toBe('text/plain');
        expect(seen.join('')).toBe('Hello, world');
    });

    test('serves an event stream as text/event-stream', async () => {
        // Given - two server-sent events declared on one route
        const url = await started([
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
});

describe('stub backend — serving declared contracts', () => {
    test('serves a declared contract with its status, body, and cors headers', async () => {
        // Given - one declared route
        const url = await started([get('/events', { items: [] })]);

        // When - the app fetches it
        const response = await fetch(`${url}/events`);

        // Then - the declared reply comes back, cors included
        expect(response.status).toBe(200);
        expect(response.headers.get('access-control-allow-origin')).toBe('*');
        expect(response.headers.get('content-type')).toBe('application/json');
        await expect(response.json()).resolves.toStrictEqual({ items: [] });
    });

    test('a contract without times keeps replying; times plays a sequence', async () => {
        // Given - a finite failure before an unlimited success on the same route
        const url = await started([
            { request: http.get('/events'), response: http.json({ n: 1 }), times: 1 },
            get('/events', { n: 2 }),
        ]);

        // Then - first the finite one, then the tail — for every re-render
        await expect(fetchJson(`${url}/events`)).resolves.toStrictEqual({ n: 1 });
        await expect(fetchJson(`${url}/events`)).resolves.toStrictEqual({ n: 2 });
        await expect(fetchJson(`${url}/events`)).resolves.toStrictEqual({ n: 2 });
    });

    test('declared query params subset-match — the app may add extras', async () => {
        // Given - a route declared with one query param
        const url = await started([get('/articles?event_id=e-1', { items: [1] })]);

        // When - the app adds a locale param
        const response = await fetch(`${url}/articles?event_id=e-1&locale=fr`);

        // Then - the declared subset matches
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toStrictEqual({ items: [1] });
    });

    test('a token segment matches structurally, whatever the id', async () => {
        // Given - a path-form route with a uuid segment
        const url = await started([get('/articles/{{uuid}}', { title: 'one' })]);

        // Then - any uuid matches, a non-uuid path does not
        const found = await fetch(`${url}/articles/3f2504e0-4f89-41d3-9a0c-0305e82c3301`);
        const missed = await fetch(`${url}/articles/not-a-uuid`);
        expect(found.status).toBe(200);
        expect(missed.status).toBe(501);
    });

    test('the request body reaches match predicates and body filters', async () => {
        // Given - two contracts on one route, routed by the posted body
        const url = await started([
            {
                request: http.post('/search', { body: { term: 'bitcoin' } }),
                response: http.json({ hits: 1 }),
            },
            { request: http.post('/search'), response: http.json({ hits: 0 }) },
        ]);

        // When - the app posts each body
        const matched = await fetch(`${url}/search`, {
            body: JSON.stringify({ term: 'bitcoin' }),
            headers: { 'content-type': 'application/json' },
            method: 'POST',
        });
        const fallback = await fetch(`${url}/search`, {
            body: JSON.stringify({ term: 'other' }),
            headers: { 'content-type': 'application/json' },
            method: 'POST',
        });

        // Then - the body-filtered contract answered the first, the bare one the second
        await expect(matched.json()).resolves.toStrictEqual({ hits: 1 });
        await expect(fallback.json()).resolves.toStrictEqual({ hits: 0 });
    });

    test('a responder computes the reply from the observed request', async () => {
        // Given - a contract whose response echoes the posted body
        const url = await started([
            {
                request: http.post('/echo'),
                response: (request) => http.json({ echoed: request.body }),
            },
        ]);

        // When - the app posts a payload
        const response = await fetch(`${url}/echo`, {
            body: JSON.stringify({ a: 1 }),
            headers: { 'content-type': 'application/json' },
            method: 'POST',
        });

        // Then - the reply derives from it
        await expect(response.json()).resolves.toStrictEqual({ echoed: { a: 1 } });
    });

    test('answers the cors preflight for any route', async () => {
        // Given - a stub with one declared route
        const url = await started([get('/events', {})]);

        // When - the browser preflights a cross-origin fetch
        const response = await fetch(`${url}/events`, {
            headers: { 'access-control-request-headers': 'x-custom' },
            method: 'OPTIONS',
        });

        // Then - 204 with permissive allow headers, echoing the requested ones
        expect(response.status).toBe(204);
        expect(response.headers.get('access-control-allow-origin')).toBe('*');
        expect(response.headers.get('access-control-allow-methods')).toContain('GET');
        expect(response.headers.get('access-control-allow-headers')).toBe('x-custom');
    });

    test('serves a body-less response and a text response as declared', async () => {
        // Given - a declared 204 and a text block
        const url = await started([
            { request: http.delete('/events/1'), response: http.empty() },
            { request: http.get('/block.txt'), response: http.text('anchored') },
        ]);

        // Then - the empty status carries no body; the text one is text/plain
        const deleted = await fetch(`${url}/events/1`, { method: 'DELETE' });
        expect(deleted.status).toBe(204);

        const text = await fetch(`${url}/block.txt`);
        expect(text.headers.get('content-type')).toContain('text/plain');
        await expect(text.text()).resolves.toBe('anchored');
    });
});

describe('stub backend — strictness (the external-block analog)', () => {
    test('an unmatched request gets a 501 naming the path and the declared routes', async () => {
        // Given - a stub declaring only /events
        const url = await started([get('/events', {})]);

        // When - the app calls an undeclared route
        const response = await fetch(`${url}/articles?x=1`);

        // Then - 501, and the body says what exists
        expect(response.status).toBe(501);
        const body = await response.json();
        expect(body.error).toContain('no contract matches GET /articles?x=1');
        expect(body.declared).toStrictEqual(['GET /events']);
    });

    test('violation() enumerates unmatched requests with their counts', async () => {
        // Given - a guarded chain and two hits on an undeclared route
        const url = await started([get('/events', {})]);
        await fetch(`${url}/articles`);
        await fetch(`${url}/articles`);
        await fetch(`${url}/ghost`, { method: 'POST' });

        // Then - the error lists every family, its count, and the declared routes
        const violation = backend!.violation();
        expect(violation).toBeInstanceOf(Error);
        expect(violation!.message).toContain('- GET /articles (2 times)');
        expect(violation!.message).toContain('- POST /ghost');
        expect(violation!.message).toContain('- GET /events');
    });

    test('violation() also reports a required contract that was never requested', async () => {
        // Given - a chain declaring a route it claims MUST be called
        const url = await started([
            get('/events', {}),
            get('/indicators?range=1M', {}, { required: true }),
        ]);
        await fetch(`${url}/events`);

        // Then - the honest failure: the screen never asked for the range
        const violation = backend!.violation();
        expect(violation!.message).toContain(
            '- GET /indicators?range=1M — declared and required but never requested',
        );
    });

    test('a chain with zero contracts leaves the stub unguarded', async () => {
        // Given - a chain that declared nothing (the MSW boundary, mirrored)
        const url = await started([]);

        // When - a request comes in anyway
        const response = await fetch(`${url}/anything`);

        // Then - it is answered 501 but never fails the action
        expect(response.status).toBe(501);
        expect(backend!.violation()).toBeNull();
    });

    test('beginChain resets the queue and the unmatched log', async () => {
        // Given - a first chain that served its contract and recorded a miss
        const url = await started([get('/events', { n: 1 })]);
        await fetch(`${url}/events`);
        await fetch(`${url}/miss`);
        expect(backend!.violation()).toBeInstanceOf(Error);

        // When - the next chain arms the stub afresh
        backend!.beginChain([get('/events', { n: 2 })]);

        // Then - the previous chain's state is gone
        expect(backend!.violation()).toBeNull();
        await expect(fetchJson(`${url}/events`)).resolves.toStrictEqual({ n: 2 });
    });
});
