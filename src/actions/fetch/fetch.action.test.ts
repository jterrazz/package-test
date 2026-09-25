import { describe, expect, test } from 'vitest';

import { clock } from '../../capabilities/clock/clock.capability.js';
import { headers } from '../../capabilities/headers/headers.capability.js';
import { interceptThrough } from '../../capabilities/intercept/intercept.scope.js';
import { defineFacet } from '../../facets/define-facet.js';
import type { FetchResult } from '../../results/fetch.result.js';
import { registerStubs, stopStubServer } from '../../seams/msw/server.js';
import type { StubRequest, StubResponse } from '../../stubs/exchange.js';
import { http } from '../../stubs/http/http.js';
import { rawFetch } from './fetch.action.js';

/** The module-scope double as the node entry publishes it. */
const intercept = interceptThrough(registerStubs);

/** One stub for the scope of a test, on an engine that stops when the scope ends. */
async function stubbed(request: StubRequest, response: StubResponse): Promise<AsyncDisposable> {
    const scope = await intercept(request, response);
    return {
        [Symbol.asyncDispose]: async () => {
            try {
                await scope[Symbol.asyncDispose]();
            } finally {
                await stopStubServer();
            }
        },
    };
}

/** A chain of `.clock()` and `.headers()`, ending on `.fetch()`. */
type Chain = {
    clock: (iso: string) => Chain;
    fetch: (path: string) => Promise<FetchResult>;
    headers: (headers: Record<string, string>) => Chain;
};

/** A chain against the site at `http://site.test`, over a clock engine that logs every pin. */
function chainOver(pinned: (null | string)[]): Chain {
    return defineFacet<Chain>()({
        actions: [rawFetch],
        capabilities: [clock, headers],
        engines: () => ({
            clock: {
                pin: (iso: null | string) => {
                    pinned.push(iso);
                    return {};
                },
            },
        }),
        locate: () => '/specs/website',
        options: {},
    }).open({ baseUrl: 'http://site.test' });
}

describe('.fetch() — one raw exchange with the site', () => {
    test('sends the chain’s headers to the site’s path, and hands back the redirect unfollowed', async () => {
        // Given - the site redirects a legacy path, but only for the crawler that names itself
        await using _ = await stubbed(
            http.get('http://site.test/old', { headers: { 'user-agent': 'GPTBot/1.0' } }),
            http.json(null, { headers: { location: '/' }, status: 308 }),
        );

        // When - the chain names the crawler and fetches the legacy path
        const result = await chainOver([]).headers({ 'User-Agent': 'GPTBot/1.0' }).fetch('/old');

        // Then - the 308 itself, with its target readable: the exchange stopped where the site answered
        expect({ location: result.location, status: result.status }).toStrictEqual({
            location: '/',
            status: 308,
        });
    });

    test('refuses a pinned clock before any setup is armed', async () => {
        // Given - a chain pinning a clock, over an engine logging every pin
        const pinned: (null | string)[] = [];

        // When - it asks for one raw exchange
        const fetched = chainOver(pinned).clock('2026-03-04T09:30:00Z').fetch('/clock');

        // Then - refused for opening no page, and nothing was pinned on the way
        await expect(fetched).rejects.toThrow('.fetch() opens none');
        expect(pinned).toStrictEqual([]);
    });
});
