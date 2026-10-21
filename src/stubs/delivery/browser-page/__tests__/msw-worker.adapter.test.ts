import { describe, expect, test, vi } from 'vitest';

import { isRunnerRequest, onUnhandledFrame } from '../msw-worker.adapter.js';

describe('mswWorker', () => {
    test("the page network — what passes without a stub — the runner's own traffic passes by its path, the subject's never by its extension", () => {
        // Given - what Vite and the runner fetch, and what a component fetches that merely looks like an asset
        const runner = [
            'http://localhost:63315/@vite/client',
            'http://localhost:63315/node_modules/.vite/deps/react.js',
            'http://localhost:63315/__vitest_browser__/tester.html',
        ];
        const subject = [
            'http://localhost:63315/api/posts.json',
            'http://localhost:63315/static/app.js',
        ];

        // Then - the runner's passes, and the subject's still answers to its stubs (`network-strict-after-first-stub`)
        expect(runner.map(isRunnerRequest)).toStrictEqual([true, true, true]);
        expect(subject.map(isRunnerRequest)).toStrictEqual([false, false]);
    });

    test("a frame no stub took — msw's error prints for the subject's HTTP request alone", () => {
        // Given - the subject's request, the runner's, a WebSocket frame and a frame whose request is no Request
        const frames = [
            { request: new Request('http://localhost:63315/api/posts.json') },
            { request: new Request('http://localhost:63315/@vite/client') },
            { protocols: undefined, url: new URL('ws://localhost:63315/live') },
            { request: 'http://localhost:63315/api/posts.json' },
            null,
        ];

        // When - each reaches msw's unhandled-frame hook
        const printed = frames.map((data) => {
            const error = vi.fn<() => void>();
            onUnhandledFrame({ defaults: { error }, frame: { data } });
            return error.mock.calls.length;
        });

        // Then - only the subject's request prints
        expect(printed).toStrictEqual([1, 0, 0, 0, 0]);
    });
});
