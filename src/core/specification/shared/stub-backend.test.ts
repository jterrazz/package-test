import { afterEach, describe, expect, test } from 'vitest';

import type { InterceptExchange } from '../../http-files/intercept-file.js';
import { StubBackend } from './stub-backend.js';

// ── Fakes — declared exchanges built inline (mocks are code, CONVENTIONS I4) ──

function exchange(
    method: string,
    path: string,
    body: unknown,
    headers: Record<string, string> = {},
): InterceptExchange {
    return {
        request: { headers, method, path },
        response: { body, hasBody: true, headers: {}, status: 200 },
    };
}

let backend: null | StubBackend = null;

afterEach(async () => {
    await backend?.stop();
    backend = null;
});

async function started(exchanges: InterceptExchange[]): Promise<string> {
    backend = new StubBackend();
    const url = await backend.start();
    backend.beginChain(exchanges);
    return url;
}

async function fetchJson(url: string): Promise<unknown> {
    const response = await fetch(url);
    return response.json();
}

describe('stub backend — serving declared exchanges', () => {
    test('serves a declared exchange with its status, body, and cors headers', async () => {
        // Given - one declared route
        const url = await started([exchange('GET', '/events', { items: [] })]);

        // When - the app fetches it
        const response = await fetch(`${url}/events`);

        // Then - the declared reply comes back, cors included
        expect(response.status).toBe(200);
        expect(response.headers.get('access-control-allow-origin')).toBe('*');
        expect(response.headers.get('content-type')).toBe('application/json');
        expect(await response.json()).toEqual({ items: [] });
    });

    test('same-route entries consume FIFO, then the last one stays sticky', async () => {
        // Given - the same route declared twice
        const url = await started([
            exchange('GET', '/events', { n: 1 }),
            exchange('GET', '/events', { n: 2 }),
        ]);

        // Then - first, second, then the second again (a re-render re-fetches)
        expect(await fetchJson(`${url}/events`)).toEqual({ n: 1 });
        expect(await fetchJson(`${url}/events`)).toEqual({ n: 2 });
        expect(await fetchJson(`${url}/events`)).toEqual({ n: 2 });
    });

    test('declared query params subset-match — the app may add extras', async () => {
        // Given - a route declared with one query param
        const url = await started([exchange('GET', '/articles?event_id=e-1', { items: [1] })]);

        // When - the app adds a locale param
        const response = await fetch(`${url}/articles?event_id=e-1&locale=fr`);

        // Then - the declared subset matches
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ items: [1] });
    });

    test('answers the cors preflight for any route', async () => {
        // Given - a stub with one declared route
        const url = await started([exchange('GET', '/events', {})]);

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

    test('serves a body-less response as declared', async () => {
        // Given - a declared 204
        const url = await started([
            {
                request: { headers: {}, method: 'DELETE', path: '/events/1' },
                response: { body: undefined, hasBody: false, headers: {}, status: 204 },
            },
        ]);

        // When - the app deletes the resource
        const response = await fetch(`${url}/events/1`, { method: 'DELETE' });

        // Then - the declared status comes back with no body
        expect(response.status).toBe(204);
    });
});

describe('stub backend — strictness (the external-block analog)', () => {
    test('an unmatched request gets a 501 naming the path and the declared routes', async () => {
        // Given - a stub declaring only /events
        const url = await started([exchange('GET', '/events', {})]);

        // When - the app calls an undeclared route
        const response = await fetch(`${url}/articles?x=1`);

        // Then - 501, and the body says what exists
        expect(response.status).toBe(501);
        const body = await response.json();
        expect(body.error).toContain('no exchange matches GET /articles?x=1');
        expect(body.declared).toEqual(['GET /events']);
    });

    test('violation() enumerates unmatched requests with their counts', async () => {
        // Given - a guarded chain and two hits on an undeclared route
        const url = await started([exchange('GET', '/events', {})]);
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

    test('a chain with zero intercepts leaves the stub unguarded', async () => {
        // Given - a chain that declared nothing (the MSW boundary, mirrored)
        const url = await started([]);

        // When - a request comes in anyway
        const response = await fetch(`${url}/anything`);

        // Then - it is answered 501 but never fails the action
        expect(response.status).toBe(501);
        expect(backend!.violation()).toBeNull();
    });

    test('beginChain resets consumption and the unmatched log', async () => {
        // Given - a first chain that consumed its entry and recorded a miss
        const url = await started([exchange('GET', '/events', { n: 1 })]);
        await fetch(`${url}/events`);
        await fetch(`${url}/miss`);
        expect(backend!.violation()).toBeInstanceOf(Error);

        // When - the next chain arms the stub afresh
        backend!.beginChain([exchange('GET', '/events', { n: 2 })]);

        // Then - the previous chain's state is gone
        expect(backend!.violation()).toBeNull();
        expect(await fetchJson(`${url}/events`)).toEqual({ n: 2 });
    });
});
