import { once } from 'node:events';
import { createServer } from 'node:http';
import { describe, expect, onTestFinished, test } from 'vitest';

import { readerOf } from '../../../chain/state.js';
import { rawFetch } from './fetch.action.js';

/** A site whose `/old` redirects and whose every other path echoes the header it was sent. */
async function site(): Promise<string> {
    const server = createServer((request, response) => {
        if (request.url === '/old') {
            response.writeHead(302, { location: '/new' }).end();
            return;
        }
        response.writeHead(200, { 'x-echo': String(request.headers['x-key']) });
        response.end(`page ${request.url}`);
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    onTestFinished(() => {
        server.close();
    });
    const address = server.address();
    return typeof address === 'object' && address !== null
        ? `http://127.0.0.1:${address.port}`
        : '';
}

const READ = readerOf({ slices: { headers: { 'x-key': 'k' } }, testDir: null });

const run = (
    baseUrl?: string,
): { config: { baseUrl?: string }; testDir: string; workDir: null } => ({
    config: baseUrl === undefined ? {} : { baseUrl },
    testDir: '/spec',
    workDir: null,
});

describe('rawFetch', () => {
    test('fetch.action — one raw exchange — sends the chain’s headers, and answers a redirect as itself, never followed', async () => {
        // Given - a site
        const baseUrl = await site();

        // When - a page and a redirect are fetched
        const page = await rawFetch.perform(['/home'], READ, {}, run(baseUrl));
        const moved = await rawFetch.perform(['/old'], READ, {}, run(baseUrl));

        // Then - the page with the header echoed, and the redirect where it points
        expect([
            page.status,
            page.body.text,
            page.headers['x-echo'],
            moved.status,
            moved.location,
        ]).toStrictEqual([200, 'page /home', 'k', 302, '/new']);
    });

    test('fetch.action — one raw exchange — a chain with no website under test is a framework fault', async () => {
        // Given - configs with no base URL, and an empty one
        // Then - each refused
        await expect(rawFetch.perform(['/'], READ, {}, run())).rejects.toThrow(
            '.fetch() reached a chain with no website under test',
        );
        await expect(rawFetch.perform(['/'], READ, {}, run(''))).rejects.toThrow(
            '.fetch() reached a chain with no website under test',
        );
    });

    test('fetch.action — preparing — opens no working directory, and refuses a chain that pinned a page’s clock', () => {
        // Given - a chain stating no clock, and one stating one
        const pinned = readerOf({ slices: { clock: '2026-01-01T00:00:00Z' }, testDir: null });

        // Then - nothing to lay, and the refusal whole
        expect(rawFetch.prepare?.(['/'], READ)).toStrictEqual({ workDir: null });
        expect(() => {
            void rawFetch.prepare?.(['/'], pinned);
        }).toThrow(
            new Error(
                [
                    'found: .clock() on a chain ending in .fetch(), which opens no page',
                    'why: .clock() pins the clock of a page, and .fetch() is one raw HTTP exchange.',
                    'fix: assert the moment with a token ({{iso8601}}) in the golden, or visit the page',
                    'read: docs/10-website.md#setup-clock',
                ].join('\n'),
            ),
        );
    });
});
