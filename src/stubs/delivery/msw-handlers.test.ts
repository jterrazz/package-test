import { HttpResponse, http as mswHttp, passthrough } from 'msw';
import { setupServer } from 'msw/node';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { describe, expect, onTestFinished, test } from 'vitest';

import { http } from '../kinds/http.js';
import type { Stub } from '../stub.js';
import { buildStubHandlers } from './msw-handlers.js';
import { fetchJson } from './other-process/stub-backend.fixtures.js';

const API = 'http://api.test';

const MSW = { http: mswHttp, HttpResponse, passthrough };

/** The stubs served in this process for the test, and the violation they record. */
function served(stubs: Stub[], bypass?: (url: string) => boolean): () => Error | null {
    const { handlers, violation } = buildStubHandlers(MSW, stubs, bypass);
    const server = setupServer(...handlers);
    server.listen({ onUnhandledRequest: 'error' });
    onTestFinished(() => {
        server.close();
    });
    return violation;
}

async function read(path: string, init?: RequestInit): Promise<(null | number | string)[]> {
    const response = await fetch(`${API}${path}`, init);
    return [
        response.status,
        response.headers.get('cache-control'),
        response.headers.get('content-type'),
        response.headers.get('x-extra'),
        await response.text(),
    ];
}

async function echo(body?: string): Promise<unknown> {
    return await fetchJson(`${API}/echo`, {
        body: body ?? null,
        headers: { 'X-Token': 't' },
        method: 'patch',
    });
}

describe('buildStubHandlers', () => {
    test('a reply — empty, text, a value or a stream, never cached, its own headers last, and a network error as a failed fetch', async () => {
        // Given - one stub of each reply
        served([
            {
                request: http.delete('/events/1'),
                response: { body: null, headers: { 'x-extra': 'a' }, status: 204 },
            },
            { request: http.get('/bare'), response: { body: undefined } },
            { request: http.get('/text'), response: http.text('plain') },
            { request: http.get('/raw'), response: { body: 'raw' } },
            {
                request: http.get('/value'),
                response: http.json({ a: 1 }, { headers: { 'cache-control': 'max-age=1' } }),
            },
            {
                request: http.get('/stream'),
                response: http.stream(['a', 'b'], { contentType: 'text/x-pieces' }),
            },
            { request: http.get('/down'), response: http.unreachable() },
        ]);

        // Then - each response as the subject reads it
        expect([
            await read('/events/1', { method: 'DELETE' }),
            await read('/bare'),
            await read('/text'),
            await read('/raw'),
            await read('/value'),
            await read('/stream'),
        ]).toStrictEqual([
            [204, 'no-store', null, 'a', ''],
            [200, 'no-store', null, null, ''],
            [200, 'no-store', 'text/plain; charset=utf-8', null, 'plain'],
            [200, 'no-store', 'text/plain; charset=utf-8', null, 'raw'],
            [200, 'max-age=1', 'application/json', null, '{"a":1}'],
            [200, 'no-store', 'text/x-pieces', null, 'ab'],
        ]);
        await expect(fetch(`${API}/down`)).rejects.toThrow(TypeError);
    });

    test('a responder — reads the body as JSON, as text, or null when none was sent, the headers and the method as observed', async () => {
        // Given - a responder echoing what it observed, on a method spelled in lower case
        served([
            {
                request: http.patch('/echo'),
                response: (request) =>
                    http.json({
                        body: request.body,
                        method: request.method,
                        token: request.headers['x-token'],
                    }),
            },
        ]);

        // Then - each body as the stub read it
        expect([await echo('{"a":1}'), await echo('plain'), await echo()]).toStrictEqual([
            { body: { a: 1 }, method: 'PATCH', token: 't' },
            { body: 'plain', method: 'PATCH', token: 't' },
            { body: null, method: 'PATCH', token: 't' },
        ]);
    });

    test('a delayed reply lands after an immediate one sent later', async () => {
        // Given - a slow route and a fast one
        served([
            { request: http.get('/slow'), response: http.json('slow', { delay: 200 }) },
            { request: http.get('/fast'), response: http.json('fast') },
        ]);

        // When - the slow one is asked first
        const landed: string[] = [];
        await Promise.all(
            ['slow', 'fast'].map(async (path) => {
                await fetch(`${API}/${path}`);
                landed.push(path);
            }),
        );

        // Then - the fast one landed first
        expect(landed).toStrictEqual(['fast', 'slow']);
    });

    test('strictness — a request no stub takes is answered 501 and recorded once, a method msw has no handler for included, and the runner’s own traffic passes through', async () => {
        // Given - one stub, one on a method with no handler, and the runner's own server beside them
        const own = createServer((_request, response) => {
            response.end('own');
        });
        own.listen(0, '127.0.0.1');
        await once(own, 'listening');
        onTestFinished(() => {
            own.close();
        });
        const address = own.address();
        const ownUrl = `http://127.0.0.1:${typeof address === 'object' && address !== null ? address.port : 0}`;
        const violation = served(
            [
                { request: http.get('/events'), response: http.json([]), times: 1 },
                { request: { ...http.get('/trace'), method: 'TRACE' }, response: http.json([]) },
            ],
            (url) => url.startsWith(ownUrl),
        );

        // When - the stub is taken twice, a route never declared is asked, and the runner reaches its own server
        await fetch(`${API}/events`);
        const spent = await read('/events');
        await read('/missing');
        const ownResponse = await fetch(ownUrl);
        const passed = await ownResponse.text();

        // Then - a 501 naming the request, the first miss recorded, the runner's request untouched
        expect([spent, violation()?.message.split('\n')[0], passed]).toStrictEqual([
            [
                501,
                'no-store',
                'application/json',
                null,
                '{"error":"@jterrazz/test strict stubs: unmatched request GET http://api.test/events"}',
            ],
            'found: an unmatched outgoing request, GET http://api.test/events; declared:',
            'own',
        ]);
    });
});
