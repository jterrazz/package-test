import { describe, expect, test } from 'vitest';

import { isRunnerRequest } from './worker.engine.js';

describe('worker.engine', () => {
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

        // Then - the runner's passes, and the subject's still answers to its stubs (D7)
        expect(runner.map(isRunnerRequest)).toStrictEqual([true, true, true]);
        expect(subject.map(isRunnerRequest)).toStrictEqual([false, false]);
    });
});
