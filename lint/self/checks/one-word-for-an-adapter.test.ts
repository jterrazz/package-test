import { describe, expect, test } from 'vitest';

import { ROOT, treeOf } from '../../engine/testing/source.fixtures.js';
import { checkOneWordForAnAdapter } from './one-word-for-an-adapter.js';

describe('checkOneWordForAnAdapter', () => {
    test('one-word-for-an-adapter — a module that adapts a port is a `*.adapter.ts`, never a `*.driver.ts`', () => {
        // Given - the package's own tree, and one with a driver of every sibling kind and an adapter
        const drifted = treeOf({
            'src/world/clock/clock.driver.browser.ts': '',
            'src/world/clock/clock.driver.fixtures.ts': '',
            'src/world/clock/clock.driver.test-d.ts': '',
            'src/world/clock/clock.driver.test.ts': '',
            'src/world/clock/clock.driver.ts': '',
            'src/world/clock/process-clock.adapter.ts': '',
            'src/world/page/page.driver.tsx': '',
        });

        // Then - the package holds none; each driver is named at itself with its own sibling kind and extension, the adapter left alone
        expect(checkOneWordForAnAdapter(ROOT)).toStrictEqual([]);
        expect(
            checkOneWordForAnAdapter(drifted).map(
                ({ file, fix, found, line }) => `${file}:${line} ${found} | ${fix}`,
            ),
        ).toStrictEqual([
            "src/world/clock/clock.driver.browser.ts:1 `clock.driver.browser.ts` carries the suffix `.driver`, a second word for an adapter | rename it `<what it adapts>.adapter.browser.ts` — the process clock's is `process-clock.adapter.ts` — and the paths that import it",
            "src/world/clock/clock.driver.fixtures.ts:1 `clock.driver.fixtures.ts` carries the suffix `.driver`, a second word for an adapter | rename it `<what it adapts>.adapter.fixtures.ts` — the process clock's is `process-clock.adapter.ts` — and the paths that import it",
            "src/world/clock/clock.driver.test-d.ts:1 `clock.driver.test-d.ts` carries the suffix `.driver`, a second word for an adapter | rename it `<what it adapts>.adapter.test-d.ts` — the process clock's is `process-clock.adapter.ts` — and the paths that import it",
            "src/world/clock/clock.driver.test.ts:1 `clock.driver.test.ts` carries the suffix `.driver`, a second word for an adapter | rename it `<what it adapts>.adapter.test.ts` — the process clock's is `process-clock.adapter.ts` — and the paths that import it",
            "src/world/clock/clock.driver.ts:1 `clock.driver.ts` carries the suffix `.driver`, a second word for an adapter | rename it `<what it adapts>.adapter.ts` — the process clock's is `process-clock.adapter.ts` — and the paths that import it",
            "src/world/page/page.driver.tsx:1 `page.driver.tsx` carries the suffix `.driver`, a second word for an adapter | rename it `<what it adapts>.adapter.tsx` — the process clock's is `process-clock.adapter.ts` — and the paths that import it",
        ]);
    });
});
