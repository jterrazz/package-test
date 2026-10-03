import { afterAll, describe, expect, test } from 'vitest';

import { intercept } from '../delivery/same-process/intercept.js';
import { stopStubServer } from '../delivery/same-process/stub-server.js';
import { http } from '../kinds/http.js';
import { defineStub } from '../stub.js';

afterAll(async () => {
    await stopStubServer();
});

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

async function reachTheEndedBlocksRoute(): Promise<void> {
    await using _ = await intercept(
        http.get('https://weather.test/tomorrow'),
        http.json({ celsius: 19 }),
    );
    await fetch('https://weather.test/today');
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

    test('intercept — the network double in module scope — resolves a relative request against the origin the scope states', async () => {
        // Given - a subject that fetches a path, the way browser code does, and a scope that says where that path lives
        await using _ = await intercept(http.get('/api/posts'), http.json({ posts: [] }), {
            origin: 'http://console.test',
        });

        // Then - the stub answers it: under node a relative URL has no base until the scope gives it one
        const response = await fetch('/api/posts');
        await expect(response.json()).resolves.toStrictEqual({ posts: [] });
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
                    'read: docs/17-stubs.md#intercept--the-same-double-with-no-chain',
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
        // Given - a block that declared one call and ended, then a second block declaring a different one
        {
            await using _ = await intercept(
                http.get('https://weather.test/today'),
                http.json({ celsius: 21 }),
            );
        }
        // Then - the first block's stub answers nothing any more
        await expect(reachTheEndedBlocksRoute()).rejects.toThrow('/today');
    });

    test('intercept — the network double in module scope — refuses an empty declaration', async () => {
        // Given - nothing declared
        // Then - the refusal says an empty list guards nothing
        await expect(intercept([])).rejects.toThrow('at least one stub');
    });
});
