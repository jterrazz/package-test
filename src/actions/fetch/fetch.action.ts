import { clock } from '../../capabilities/clock/clock.capability.js';
import { headers } from '../../capabilities/headers/headers.capability.js';
import { defineAction } from '../../model/chain/action.js';
import { FetchResult } from '../../results/fetch.result.js';

/**
 * `.fetch(path)`: one raw HTTP GET against the site under test — redirects
 * are never followed, a 308 IS the result. It opens no page, so a chain that
 * pinned a page's clock is refused before anything is armed.
 */
export const rawFetch = defineAction<'fetch', [path: string], FetchResult>({
    accessors: [
        { group: 'Result accessor', name: '.status', probe: 'result.status' },
        { group: 'Result accessor', name: '.body', probe: 'result.body' },
        { group: 'Result accessor', name: '.json', probe: 'result.json' },
        { group: 'Result accessor', name: '.headers', probe: 'result.headers' },
        { group: 'Result accessor', name: '.location', probe: 'result.location' },
    ],
    name: 'fetch',
    perform: async ([path], read, _engines, { config, testDir }) => {
        const { baseUrl } = config;
        if (baseUrl === undefined || baseUrl === '') {
            throw new Error('.fetch() requires a website under test (use specification.website())');
        }
        const response = await fetch(`${baseUrl}${path}`, {
            headers: read(headers),
            redirect: 'manual',
        });
        const body = await response.text();
        const received: Record<string, string> = {};
        response.headers.forEach((value, key) => {
            received[key] = value;
        });
        return new FetchResult({
            config,
            exchange: { body, headers: received, status: response.status },
            testDir,
        });
    },
    prepare: (_args, read) => {
        if (read(clock) !== null) {
            throw new Error(
                '.clock() pins the clock of a PAGE, and .fetch() opens none — it is one raw HTTP ' +
                    'exchange. Assert the moment with a token ({{iso8601}}) in the golden, or visit the page.',
            );
        }
        return { workDir: null };
    },
    row: { group: 'Terminal action', name: '.fetch()', probe: ".fetch('" },
});
