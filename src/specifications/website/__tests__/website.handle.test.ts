import { describe, expect, test } from 'vitest';

import { refuseOptions } from '../website.handle.js';
import type { WebsiteSpecificationOptions } from '../website.handle.js';

const OPTIONS = 'read: docs/guides/website-specs.md#options';

function refusalOf(options: WebsiteSpecificationOptions): string {
    try {
        refuseOptions(options);
        return '';
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
}

describe('website.handle', () => {
    test('website.handle — the site a specification drives — a url or a server is a site, a backend needs the server, and no site or a backend beside a url is refused', () => {
        // Given - a url, a server with a backend, a blank url, an absent one, and a backend with no server
        const noSite = (url?: string): string =>
            [
                `found: specification.website({ url: ${JSON.stringify(url)} }), no site to specify`,
                'why: A website spec names the site it drives: a deployed `url`, or a `server` it starts.',
                'fix: pass the absolute URL of the site as `url`, or start it with `server`',
                OPTIONS,
            ].join('\n');

        // Then - each site accepted, each refusal whole
        expect([
            refusalOf({ url: 'https://site.test' }),
            refusalOf({ backend: { env: 'API_URL' }, server: { command: 'serve' } }),
            refusalOf({ url: '  ' }),
            // @ts-expect-error -- neither url nor server: the type refuses it at every typed site
            refusalOf({}),
            // @ts-expect-error -- a backend beside a url: the type refuses it at every typed site
            refusalOf({ backend: { env: 'API_URL' }, url: 'https://site.test' }),
        ]).toStrictEqual([
            '',
            '',
            noSite('  '),
            noSite(),
            [
                'found: specification.website({ url, backend }), a backend beside a deployed url',
                'why: `backend` requires `server` mode: a deployed `url` cannot be pointed at a local stub.',
                'fix: start the site with `server`, or drop `backend`',
                OPTIONS,
            ].join('\n'),
        ]);
    });
});
