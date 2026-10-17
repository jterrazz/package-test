import { defineAction } from '../../../chain/action.js';
import type { ChainSignature } from '../../../chain/capability.js';
import { headers } from '../../../chain/context/headers.capability.js';
import { invariant, refusal } from '../../../chain/refusals/refusal.js';
import { clock } from '../../../clock/clock.capability.js';
import { storage } from '../browser/storage.capability.js';
import type { WebsiteConfig } from '../website.handle.js';
import { FetchResult } from './fetch.result.js';

export type FetchOptions = {
    /** The HTTP method of the exchange; a GET when none is given. */
    method?: 'DELETE' | 'GET' | 'HEAD' | 'OPTIONS' | 'PATCH' | 'POST' | 'PUT';
};

export type FetchSignature = ChainSignature & {
    readonly chain: {
        /** Perform one raw HTTP exchange, a GET unless `method` says otherwise; redirects surface as 3xx results, never followed. */
        fetch: (path: string, options?: FetchOptions) => Promise<FetchResult>;
    };
};

/** Redirects are never followed; it opens no page, so a chain that pinned a page's clock is refused. */
export const rawFetch = defineAction<
    'fetch',
    [path: string, options?: FetchOptions],
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
    perform: async ([path, options], read, _adapters, { config, testDir }) => {
        const { baseUrl } = config;
        if (baseUrl === undefined || baseUrl === '') {
            throw invariant('.fetch() reached a chain with no website under test');
        }
        const response = await fetch(`${baseUrl}${path}`, {
            headers: read(headers),
            method: options?.method ?? 'GET',
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
                    read: 'docs/guides/website-specs.md#setup-clock',
                    why: '.clock() pins the clock of a page, and .fetch() is one raw HTTP exchange.',
                }),
            );
        }
        if (read(storage) !== null) {
            throw new Error(
                refusal({
                    fix: 'visit the page, or drop .storage()',
                    found: '.storage() on a chain ending in .fetch(), which opens no page',
                    read: 'docs/guides/website-specs.md#storage',
                    why: '.storage() seeds or blocks the web storage of a page, and .fetch() is one raw HTTP exchange.',
                }),
            );
        }
        return { workDir: null };
    },
    row: { group: 'Terminal action', name: '.fetch()', probe: ".fetch('" },
});
