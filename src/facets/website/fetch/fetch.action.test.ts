import { describe, expect, test } from 'vitest';

import { headers } from '../../../chain/context/headers.capability.js';
import { defineFacet } from '../../../chain/define-facet.js';
import { clock } from '../../../clock/clock.capability.js';
import { registerStubs, stopStubServer } from '../../../stubs/delivery/same-process/stub-server.js';
import type { StubRequest, StubResponse } from '../../../stubs/exchange.js';
import { interceptThrough } from '../../../stubs/intercept/intercept.js';
import { http } from '../../../stubs/kinds/http.js';
import type { WebsiteConfig } from '../website.handle.js';
import { rawFetch } from './fetch.action.js';
import type { FetchResult } from './fetch.result.js';

const intercept = interceptThrough(registerStubs);

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

type Chain = {
    clock: (iso: string) => Chain;
    fetch: (path: string) => Promise<FetchResult>;
    headers: (headers: Record<string, string>) => Chain;
};

function chainOver(pinned: (null | string)[]): Chain {
    return defineFacet<Chain, WebsiteConfig>()({
        actions: [rawFetch],
        capabilities: [clock, headers],
        adapters: () => ({
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

describe('rawFetch', () => {
    test('.fetch() — one raw exchange with the site — sends the chain’s headers to the site’s path, and hands back the redirect unfollowed', async () => {
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

    test('.fetch() — one raw exchange with the site — refuses a pinned clock before any setup is armed', async () => {
        // Given - a chain pinning a clock, over an adapter logging every pin
        const pinned: (null | string)[] = [];

        // When - it asks for one raw exchange
        const fetched = chainOver(pinned).clock('2026-03-04T09:30:00Z').fetch('/clock');

        // Then - refused for opening no page, and nothing was pinned on the way
        await expect(fetched).rejects.toThrow(
            new Error(
                [
                    'found: .clock() on a chain ending in .fetch(), which opens no page',
                    'why: .clock() pins the clock of a page, and .fetch() is one raw HTTP exchange.',
                    'fix: assert the moment with a token ({{iso8601}}) in the golden, or visit the page',
                    'read: docs/08-website.md#setup-clock',
                ].join('\n'),
            ),
        );
        expect(pinned).toStrictEqual([]);
    });
});
