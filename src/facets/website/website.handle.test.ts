import { describe, expect, test } from 'vitest';

import { startWebsite } from './website.handle.js';

describe('startWebsite', () => {
    test('specification.website() — what it refuses before starting anything — a stub backend beside a deployed url is refused, for a caller the types do not reach', async () => {
        // Given - an untyped caller pointing a deployed site at a local stub
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the pair is what the type refuses; this test IS the caller the type does not reach
        const options = { backend: { env: 'API_URL' }, url: 'https://example.test' } as never;

        // Then - refused in the words of the type it slipped past: the deployed site would never call the stub
        await expect(startWebsite(options)).rejects.toThrow(
            [
                'found: specification.website({ url, backend }), a backend beside a deployed url',
                'why: `backend` requires `server` mode: a deployed `url` cannot be pointed at a local stub.',
                'fix: start the site with `server`, or drop `backend`',
                'read: docs/08-website.md#options',
            ].join('\n'),
        );
    });

    test('specification.website() — what it refuses before starting anything — an empty url is refused, as an env var left unset hands it', async () => {
        // Given - a url read from an environment variable nobody set
        const options = { url: '' };

        // Then - refused before any action reaches a site with no address
        await expect(startWebsite(options)).rejects.toThrow(
            [
                'found: specification.website({ url: "" }), no site to specify',
                'why: A website spec names the site it drives: a deployed `url`, or a `server` it starts.',
                'fix: pass the absolute URL of the site as `url`, or start it with `server`',
                'read: docs/08-website.md#options',
            ].join('\n'),
        );
    });
});
