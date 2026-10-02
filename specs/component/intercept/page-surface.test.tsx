import {
    component,
    content,
    http,
    intercept,
    mockOf,
    postgres,
    ProcessHandle,
    required,
    waitUntil,
} from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { SurfacePanel } from './page-surface.js';
import type { SurfacePort } from './page-surface.js';

/** Run on the page's own runtime rather than compared by name with the node build. `intercept()` serves a test with no chain: a render declares its network on the chain. */

const nodeOnly = (binding: string): Error =>
    new Error(
        [
            `found: ${binding} runs under node, and was called in a page`,
            'why: A page has no filesystem, no child process and no socket.',
            'fix: specify it from a test collected by a node project (unit/api/job/cli/website/mobile); a rendered thing is a `.test.tsx` beside its component',
            'read: docs/07-component.md#what-it-does-not-do',
        ].join('\n'),
    );

describe('SurfacePanel', () => {
    test('the module-scope double answers the page, from its own worker', async () => {
        // Given - stubs declared with no chain to hang them on
        await using _ = await intercept(http.get('/api/surface'), http.text('from the worker'));

        // Then - the page's own fetch is served by msw/browser
        const response = await fetch('/api/surface');
        await expect(response.text()).resolves.toBe('from the worker');
    });

    test('a stub forbidding the cookie answers a page request, the browser adding the cookie after the worker', async () => {
        // Given - a session cookie on the page, and a stub declared only for a request without a cookie
        await cookieStore.set('session', '1');
        await using _ = await intercept(
            http.get('/api/surface', { without: { headers: ['cookie'] } }),
            http.text('anonymous'),
        );

        // Then - the cookie is the page's, yet the worker sees the request before it is added, so the stub fires
        await expect(cookieStore.get('session')).resolves.toMatchObject({ value: '1' });
        const response = await fetch('/api/surface');
        await cookieStore.delete('session');
        await expect(response.text()).resolves.toBe('anonymous');
    });

    test('a port double is a render prop, and records what the unit told it', async () => {
        // Given - the unit's collaborator as a double, and its network on the chain
        const port = mockOf<SurfacePort>();
        const result = await component
            .intercept(http.get('/api/surface'), http.text('announced'))
            .render(<SurfacePanel port={port} />, async (visitor) => {
                await visitor.see(content('announced'));
            });

        // Then - the page rendered it, and the port heard it
        expect(result.content.text).toContain('announced');
        expect(port.announce).toHaveBeenCalledWith('announced');
    });

    test('a shallow double answers here the way it answers in a module test', () => {
        // Given - the double asked to be one level deep only
        const port = mockOf<SurfacePort>({ deep: false });

        // Then - the call is recorded, in a page, by the same name
        port.announce('hello');
        expect(port.announce).toHaveBeenCalledWith('hello');
    });

    test('waitUntil polls a condition inside the page too', async () => {
        // Given - a condition that becomes true on the third reading
        let readings = 0;

        // Then - the helper polled it rather than sleeping a guessed duration
        await waitUntil(
            () => {
                readings += 1;
                return readings === 3;
            },
            { interval: 1, why: 'the third reading' },
        );
        expect(required(readings, 'the reading count')).toBe(3);
    });

    test('a binding only node can run is refused where the page calls it, saying where it runs', () => {
        // Given - a service and a node-only class, reached from the page entry
        // Then - each is refused at the call, the class when it is constructed rather than when it is named
        expect(() => postgres()).toThrow(nodeOnly('postgres()'));
        expect(() => new ProcessHandle({ command: 'node server.mjs', ready: /ready/u })).toThrow(
            nodeOnly('ProcessHandle'),
        );
    });
});
