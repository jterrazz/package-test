import { defineAction } from '../../../chain/action.js';
import type { ChainSignature } from '../../../chain/capability.js';
import { headers } from '../../../chain/context/headers.capability.js';
import { invariant, refusal } from '../../../chain/refusals/refusal.js';
import { clock } from '../../../clock/clock.capability.js';
import type { WebsiteConfig } from '../website.handle.js';
import { FetchResult } from './fetch.result.js';

export type FetchSignature = ChainSignature & {
    readonly chain: {
        /** Perform one raw HTTP GET — redirects surface as 3xx results, never followed. */
        fetch: (path: string) => Promise<FetchResult>;
    };
};

/** Redirects are never followed; it opens no page, so a chain that pinned a page's clock is refused. */
export const rawFetch = defineAction<
    'fetch',
    [path: string],
    FetchResult,
    FetchSignature,
    Record<never, never>,
    WebsiteConfig
>({
    accessors: [
        { group: 'Result accessor', name: '.status', probe: 'result.status' },
        { group: 'Result accessor', name: '.body', probe: 'result.body' },
        { group: 'Result accessor', name: '.json', probe: 'result.json' },
        { group: 'Result accessor', name: '.headers', probe: 'result.headers' },
        { group: 'Result accessor', name: '.location', probe: 'result.location' },
    ],
    name: 'fetch',
    perform: async ([path], read, _adapters, { config, testDir }) => {
        const { baseUrl } = config;
        if (baseUrl === undefined || baseUrl === '') {
            throw invariant('.fetch() reached a chain with no website under test');
        }
        const response = await fetch(`${baseUrl}${path}`, {
            headers: read(headers),
            redirect: 'manual',
        });
        const body = await response.text();
        const received: Record<string, string> = Object.fromEntries(response.headers);
        return new FetchResult({
            config,
            exchange: { body, headers: received, status: response.status },
            testDir,
        });
    },
    prepare: (_args, read) => {
        if (read(clock) !== null) {
            throw new Error(
                refusal({
                    fix: 'assert the moment with a token ({{iso8601}}) in the golden, or visit the page',
                    found: '.clock() on a chain ending in .fetch(), which opens no page',
                    read: 'docs/10-website.md#setup-clock',
                    why: '.clock() pins the clock of a page, and .fetch() is one raw HTTP exchange.',
                }),
            );
        }
        return { workDir: null };
    },
    row: { group: 'Terminal action', name: '.fetch()', probe: ".fetch('" },
});
