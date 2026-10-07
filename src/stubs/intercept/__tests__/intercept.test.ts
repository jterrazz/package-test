import { once } from 'node:events';
import { createServer } from 'node:http';
import { afterAll, describe, expect, onTestFinished, test, vi } from 'vitest';

import { intercept } from '../../delivery/same-process/intercept.js';
import { stopStubServer } from '../../delivery/same-process/stub-server.js';
import { http } from '../../kinds/http.js';
import { defineStub } from '../../stub.js';

afterAll(async () => {
    await stopStubServer();
});

async function answerOf(input: Request | string): Promise<unknown> {
    const response = await fetch(input);
    const body: unknown = await response.json();
    return body;
}

async function interceptOnABareHost(): Promise<void> {
    await using _ = await intercept(http.get('/api/posts'), http.json({}), {
        origin: 'console.test',
    });
}

async function reachAnUndeclaredHost(): Promise<void> {
    await using _ = await intercept(
        http.get('https://weather.test/today'),
        http.json({ celsius: 21 }),
    );
    await fetch('https://analytics.test/collect');
}

/** A server on port 0 answering every request itself, closed with the test. */
async function realServer(): Promise<string> {
    const server = createServer((_, response) => {
        response.end('the real forecast');
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    onTestFinished(() => {
        server.close();
    });
    const address = server.address();
    return typeof address === 'object' && address !== null
        ? `http://127.0.0.1:${address.port}`
        : '';
}

describe('interceptThrough', () => {
    test('intercept — the network double in module scope — answers the declared call and never reaches the wire', async () => {
        // Given - one stub declared for the block
        await using _ = await intercept(
            http.get('https://weather.test/today'),
            http.json({ celsius: 21 }),
        );

        // Then - the subject's own fetch is answered by it
        const response = await fetch('https://weather.test/today');
        await expect(response.json()).resolves.toStrictEqual({ celsius: 21 });
    });

    test('intercept — the network double in module scope — takes a composite the same way a chain does', async () => {
        // Given - a stub built the declarative way
        const forecast = defineStub({
            request: http.get('https://weather.test/tomorrow'),
            response: http.json({ celsius: 19 }),
        });
        await using _ = await intercept(forecast);

        // Then - the composite answers
        const response = await fetch('https://weather.test/tomorrow');
        await expect(response.json()).resolves.toStrictEqual({ celsius: 19 });
    });

    test('intercept — the network double in module scope — resolves a relative request against the origin the scope states, and leaves an absolute one where it points', async () => {
        // Given - a subject that fetches a path and a path relative to the page, the way browser code does, and a scope that says where they live
        await using _ = await intercept(
            [
                defineStub({ request: http.get('/api/posts'), response: http.json({ posts: [] }) }),
                defineStub({
                    request: http.get('https://weather.test/today'),
                    response: http.json({ celsius: 21 }),
                }),
            ],
            { origin: 'http://console.test' },
        );

        // When - it fetches each, and the absolute call as a string and as a Request
        const answers = await Promise.all(
            [
                '/api/posts',
                'api/posts',
                'https://weather.test/today',
                new Request('https://weather.test/today'),
            ].map(answerOf),
        );

        // Then - the stubs answer them: under node a relative URL has no base until the scope gives it one
        expect(answers).toStrictEqual([
            { posts: [] },
            { posts: [] },
            { celsius: 21 },
            { celsius: 21 },
        ]);
    });

    test('intercept — the network double in module scope — gives `fetch` back when the scope ends', async () => {
        // Given - a scope that stated an origin, and ended
        const original = globalThis.fetch;
        {
            await using _ = await intercept(http.get('/api/posts'), http.json({ posts: [] }), {
                origin: 'http://console.test',
            });
            await fetch('/api/posts');
        }

        // Then - whatever `fetch` the scope was opened on is in place again
        expect(globalThis.fetch).toBe(original);
    });

    test('intercept — the network double in module scope — resolves a relative request when the scope is what starts the adapter', async () => {
        // Given - nothing listening yet, the state the FIRST intercept of a file finds
        await stopStubServer();
        await using _ = await intercept(http.get('/api/posts'), http.json({ posts: ['first'] }), {
            origin: 'http://console.test',
        });

        // Then - the stub answers: the wrapper went on TOP of the fetch the adapter installed while registering
        const response = await fetch('/api/posts');
        await expect(response.json()).resolves.toStrictEqual({ posts: ['first'] });
    });

    test('intercept — the network double in module scope — leaves the adapter in charge of the scopes that follow it', async () => {
        // Given - an origin scope that was the adapter's first registration, and ended
        await stopStubServer();
        {
            await using _ = await intercept(http.get('/api/posts'), http.json({ posts: [] }), {
                origin: 'http://console.test',
            });
            await fetch('/api/posts');
        }

        // Then - the next scope is still guarded: its disposal put the ADAPTER's fetch back, not the one that preceded the adapter
        await using _ = await intercept(
            http.get('https://weather.test/today'),
            http.json({ celsius: 21 }),
        );
        const response = await fetch('https://weather.test/today');
        await expect(response.json()).resolves.toStrictEqual({ celsius: 21 });
    });

    test('intercept — the network double in module scope — settles a cancel of the body the subject was served', async () => {
        // Given - an error reply with a body, which the subject drops unread
        await using _ = await intercept(
            http.get('https://weather.test/today'),
            http.error(503, { reason: 'the station is down' }),
        );
        const response = await fetch('https://weather.test/today');

        // Then - the cancel resolves, the status still readable
        await expect(response.body?.cancel()).resolves.toBeUndefined();
        expect(response.status).toBe(503);
    });

    test('intercept — the network double in module scope — refuses an origin that is not one', async () => {
        // Given - a scope stating a bare host
        // Then - the message says what an origin is
        await expect(interceptOnABareHost()).rejects.toThrow(
            new Error(
                [
                    'found: intercept(): `origin` is `console.test`, not an absolute URL',
                    'why: `origin` states where a relative request resolves, so it is an absolute URL.',
                    "fix: state an absolute URL: intercept(stubs, { origin: 'http://console.test' })",
                    'read: docs/reference/stubs.md#intercept--the-same-double-with-no-chain',
                ].join('\n'),
            ),
        );
    });

    test('intercept — the network double in module scope — raises the undeclared call when the scope ends', async () => {
        // Given - a block that reaches a second host nothing declared
        // Then - the scope refuses it rather than letting it pass (`network-strict-after-first-stub`)
        await expect(reachAnUndeclaredHost()).rejects.toThrow('analytics.test');
    });

    test('intercept — the network double in module scope — lets the handlers of a block go when the block ends', async () => {
        // Given - a real server, and a block that stubbed its one route and ended, the first of the adapter
        await stopStubServer();
        const real = await realServer();
        {
            await using _ = await intercept(http.get(`${real}/today`), http.json({ celsius: 21 }));
        }
        const warned = vi.spyOn(console, 'warn').mockReturnValue();
        onTestFinished(() => {
            warned.mockRestore();
        });

        // When - the subject calls the route again
        const response = await fetch(`${real}/today`);

        // Then - the real server answers, unremarked: the block's stub is gone, and a call no scope declares passes through
        await expect(response.text()).resolves.toBe('the real forecast');
        expect(warned).not.toHaveBeenCalled();
    });

    test('intercept — the network double in module scope — refuses an empty declaration', async () => {
        // Given - nothing declared
        // Then - the refusal says an empty list guards nothing
        await expect(intercept([])).rejects.toThrow(
            new Error(
                [
                    'found: intercept(), and the list of stubs is empty',
                    'why: An empty list guards nothing.',
                    'fix: declare at least one stub, or drop the intercept: a subject with no network needs none',
                    'read: docs/reference/stubs.md#intercept--the-same-double-with-no-chain',
                ].join('\n'),
            ),
        );
    });

    test('intercept — the network double in module scope — refuses a request with no response in its own words', async () => {
        // Given - a caller the types do not reach, declaring a request alone
        // Then - the refusal names intercept()
        // @ts-expect-error -- a bare request: the overloads refuse it at every typed site
        await expect(intercept(http.get('https://news.test/latest'))).rejects.toThrow(
            'found: intercept(request), a bare request with no response',
        );
    });
});
