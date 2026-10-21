import { describe, expect, test, vi } from 'vitest';

import { clock } from '../../../clock/clock.js';
import {
    fakeContainers,
    fakeService,
} from '../../../services/startup/__tests__/orchestrator.fixtures.js';
import type { CallLog } from '../../../services/startup/__tests__/orchestrator.fixtures.js';
import { refuseOptions, startWebsite } from '../website.handle.js';
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

    test('website.handle — a server that never comes up — the services started for it are released and stopped', async () => {
        // Given - a cache on a fake container, and a server that exits before it is ready
        using _ = clock.at('2026-10-21T10:00:00.000Z');
        const log: CallLog = [];
        fakeContainers(log);
        const printed = vi.spyOn(console, 'log').mockReturnValue();

        // When - the website starts
        const starting = startWebsite({
            server: { command: `node -e "process.exit(3)"`, ready: /never/u },
            services: { cache: fakeService(log, 'redis:7') },
        });

        // Then - the start is refused, and the cache was acquired, then released, then its container stopped
        await expect(starting).rejects.toThrow('the server command exited before it was ready');
        printed.mockRestore();
        expect(log.filter((line) => /^(?:acquire|release|stop) /u.test(line))).toStrictEqual([
            `acquire redis:7 ${process.env.VITEST_POOL_ID}`,
            'release redis:7',
            'stop redis:7',
        ]);
    });
});
