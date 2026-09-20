import { afterAll, describe, expect, test } from 'vitest';

import { registerContracts, stopContractServer } from '../../seams/msw/server.js';
import { defineContract } from './contract.js';
import { http } from './http.js';
import { declared, interceptThrough } from './intercept.js';

/** The module-scope double as the node entry publishes it. */
const intercept = interceptThrough(registerContracts);

afterAll(async () => {
    await stopContractServer();
});

describe('intercept — the network double in module scope', () => {
    test('answers the declared call and never reaches the wire', async () => {
        // Given - one contract declared for the block
        await using _ = await intercept(
            http.get('https://weather.test/today'),
            http.json({ celsius: 21 }),
        );

        // Then - the subject's own fetch is answered by it
        const response = await fetch('https://weather.test/today');
        await expect(response.json()).resolves.toStrictEqual({ celsius: 21 });
    });

    test('takes a composite the same way a chain does', async () => {
        // Given - a contract built the declarative way
        const forecast = defineContract({
            request: http.get('https://weather.test/tomorrow'),
            response: http.json({ celsius: 19 }),
        });
        await using _ = await intercept(forecast);

        // Then - the composite answers
        const response = await fetch('https://weather.test/tomorrow');
        await expect(response.json()).resolves.toStrictEqual({ celsius: 19 });
    });

    test('resolves a relative request against the origin the scope states', async () => {
        // Given - a subject that fetches a path, the way browser code does, and a scope that says where that path lives
        await using _ = await intercept(http.get('/api/posts'), http.json({ posts: [] }), {
            origin: 'http://console.test',
        });

        // Then - the contract answers it: under node a relative URL has no base until the scope gives it one
        const response = await fetch('/api/posts');
        await expect(response.json()).resolves.toStrictEqual({ posts: [] });
    });

    test('gives `fetch` back when the scope ends', async () => {
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

    test('resolves a relative request when the scope is what starts the engine', async () => {
        // Given - nothing listening yet, the state the FIRST intercept of a file finds
        await stopContractServer();
        await using _ = await intercept(http.get('/api/posts'), http.json({ posts: ['first'] }), {
            origin: 'http://console.test',
        });

        // Then - the contract answers: the wrapper went on TOP of the fetch the engine installed while registering
        const response = await fetch('/api/posts');
        await expect(response.json()).resolves.toStrictEqual({ posts: ['first'] });
    });

    test('leaves the engine in charge of the scopes that follow it', async () => {
        // Given - an origin scope that was the engine's first registration, and ended
        await stopContractServer();
        {
            await using _ = await intercept(http.get('/api/posts'), http.json({ posts: [] }), {
                origin: 'http://console.test',
            });
            await fetch('/api/posts');
        }

        // Then - the next scope is still guarded: its disposal put the ENGINE's fetch back, not the one that preceded the engine
        await using _ = await intercept(
            http.get('https://weather.test/today'),
            http.json({ celsius: 21 }),
        );
        const response = await fetch('https://weather.test/today');
        await expect(response.json()).resolves.toStrictEqual({ celsius: 21 });
    });

    test('refuses an origin that is not one', async () => {
        // Given - a scope stating a bare host
        const scope = async (): Promise<void> => {
            await using _ = await intercept(http.get('/api/posts'), http.json({}), {
                origin: 'console.test',
            });
        };

        // Then - the message says what an origin is
        await expect(scope()).rejects.toThrow('is not an absolute URL');
    });

    test('raises the undeclared call when the scope ends', async () => {
        // Given - a block that reaches a second host nothing declared
        const escape = async (): Promise<void> => {
            await using _ = await intercept(
                http.get('https://weather.test/today'),
                http.json({ celsius: 21 }),
            );
            await fetch('https://analytics.test/collect');
        };

        // Then - the scope refuses it rather than letting it pass (D7)
        await expect(escape()).rejects.toThrow('analytics.test');
    });

    test('lets the handlers of a block go when the block ends', async () => {
        // Given - a block that declared one call and ended, then a second block declaring a different one
        {
            await using _ = await intercept(
                http.get('https://weather.test/today'),
                http.json({ celsius: 21 }),
            );
        }
        const stale = async (): Promise<void> => {
            await using _ = await intercept(
                http.get('https://weather.test/tomorrow'),
                http.json({ celsius: 19 }),
            );
            await fetch('https://weather.test/today');
        };

        // Then - the first block's contract answers nothing any more
        await expect(stale()).rejects.toThrow('/today');
    });

    test('refuses a bare request with no response', () => {
        // Given - a request half handed over alone, as only an untyped caller can hand it (the overloads refuse the shape at every typed site)
        // Then - the refusal names both ways to give it its reply
        expect(() => declared(http.get('https://weather.test/today'))).toThrow(
            'a bare request needs its response',
        );
    });

    test('refuses an empty declaration', async () => {
        // Given - nothing declared
        // Then - the refusal says an empty list guards nothing
        await expect(intercept([])).rejects.toThrow('at least one contract');
    });
});
