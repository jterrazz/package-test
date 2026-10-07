import { describe, expect, test } from 'vitest';

import { readerOf } from '../../../../chain/state.js';
import type { BrowserOpenOptions, BrowserPage } from '../../browser/browser.port.js';
import type { WebsiteConfig } from '../../website.handle.js';
import type { PageResult } from '../page.result.js';
import { visit } from '../visit.action.js';

const PAGE: BrowserPage = {
    consoleMessages: [],
    html: '<html></html>',
    jsonLdBlocks: [],
    links: [],
    metas: [],
    status: 200,
    text: 'hi',
    tree: '- text: hi',
    title: 'Home',
    url: 'http://site.test/',
};

/** What a visit asked the browser to open, and what it answered. */
async function visited(
    config: WebsiteConfig,
    slices: Record<string, unknown> = {},
): Promise<{ opened: [string, BrowserOpenOptions][]; result: PageResult }> {
    const opened: [string, BrowserOpenOptions][] = [];
    const browser = async () =>
        await Promise.resolve({
            close: async () => {
                await Promise.resolve();
            },
            open: async (url: string, options: BrowserOpenOptions) => {
                opened.push([url, options]);
                return await Promise.resolve(PAGE);
            },
        });
    const result = await visit.perform(
        ['/home'],
        readerOf({ slices, testDir: null }),
        { browser },
        { config, testDir: '/spec', workDir: null },
    );
    return { opened, result };
}

describe('visit', () => {
    test('visit — opens the page at the site under test with the chain’s headers and clock, the stub backend allowed, external requests allowed unless blocked', async () => {
        // Given - a site with a backend and headers and a clock on the chain, and one with neither, blocking external requests
        const full = await visited(
            { backendUrl: 'http://127.0.0.1:4100/api', baseUrl: 'http://site.test' },
            { clock: '2026-01-01T00:00:00Z', headers: { 'x-a': '1' } },
        );
        const bare = await visited({ baseUrl: 'http://site.test', external: 'block' });

        // Then - each open, and the page it answered
        expect([full.opened, bare.opened, full.result.status, full.result.url]).toStrictEqual([
            [
                [
                    'http://site.test/home',
                    {
                        allowedOrigins: ['http://127.0.0.1:4100'],
                        baseUrl: 'http://site.test',
                        clock: '2026-01-01T00:00:00Z',
                        external: 'allow',
                        headers: { 'x-a': '1' },
                        scenario: undefined,
                    },
                ],
            ],
            [
                [
                    'http://site.test/home',
                    {
                        allowedOrigins: undefined,
                        baseUrl: 'http://site.test',
                        external: 'block',
                        headers: undefined,
                        scenario: undefined,
                    },
                ],
            ],
            200,
            'http://site.test/',
        ]);
    });

    test('visit — a chain with no website under test is a framework fault, named', async () => {
        // Given - a config with no base URL, and one with an empty one
        // Then - each refused before any browser opens
        await expect(visited({})).rejects.toThrow(
            '.visit() reached a chain with no website under test',
        );
        await expect(visited({ baseUrl: '' })).rejects.toThrow(
            '.visit() reached a chain with no website under test',
        );
    });
});
