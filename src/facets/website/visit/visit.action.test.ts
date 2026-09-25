import { describe, expect, test } from 'vitest';

import type {
    BrowserOpenOptions,
    BrowserPage,
    BrowserPort,
} from '../../../elements/browser.port.js';
import { defineFacet } from '../../../kernel/chain/define-facet.js';
import { headers } from '../../../kernel/context/headers.capability.js';
import { sharing } from '../../../kernel/context/with.capability.js';
import { visit } from './visit.action.js';

/** A page with nothing rendered — what a visit hands back when only its request matters. */
const BLANK: BrowserPage = {
    consoleMessages: [],
    html: '',
    jsonLdBlocks: [],
    links: [],
    metas: [],
    status: 200,
    text: '',
    title: '',
    tree: '',
    url: 'http://127.0.0.1:9/',
};

/** A chain of `.headers()` and `with()`, ending on `.visit()`. */
type Chain = {
    headers: (headers: Record<string, string>) => Chain;
    visit: (path: string) => Promise<unknown>;
    with: (context: { headers?: Record<string, string> }) => Chain;
};

/** A chain over a browser that records the headers of every visit it opens. */
function chainOver(sent: BrowserOpenOptions['headers'][]): Chain {
    const browser: BrowserPort = {
        close: async () => {
            await Promise.resolve();
        },
        open: async (_url, options) => {
            sent.push(options.headers);
            return await Promise.resolve(BLANK);
        },
    };
    return defineFacet<Chain>()({
        actions: [visit],
        capabilities: [headers, sharing],
        engines: () => ({ browser: async () => await Promise.resolve(browser) }),
        locate: () => '/specs/website',
        options: {},
    }).open({ baseUrl: 'http://127.0.0.1:9' });
}

describe('.visit() — the page a chain renders', () => {
    test("a view sends its headers on every visit, and a chain's own headers win for that chain alone", async () => {
        // Given - a view sharing a header, over a browser recording the headers of each visit
        const sent: BrowserOpenOptions['headers'][] = [];
        const website = chainOver(sent).with({ headers: { 'x-chain': 'file' } });

        // When - two chains of the view, one setting its own header, then one more chain of the view
        await website.visit('/');
        await website.visit('/');
        await website.headers({ 'x-chain': 'own' }).visit('/');
        await website.visit('/');

        // Then - the shared header on every chain, the chain's own replacing it on that chain alone
        expect(sent).toStrictEqual([
            { 'x-chain': 'file' },
            { 'x-chain': 'file' },
            { 'x-chain': 'own' },
            { 'x-chain': 'file' },
        ]);
    });
});
