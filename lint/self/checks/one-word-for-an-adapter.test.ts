import { describe, expect, test } from 'vitest';

import { located, ROOT, treeOf } from '../../kit/testing/source.fixtures.js';
import { checkOneWordForAnAdapter } from './one-word-for-an-adapter.js';

describe('checkOneWordForAnAdapter', () => {
    test('one-word-for-an-adapter — a module that adapts a port is a `*.adapter.ts`, never a `*.driver.ts`', () => {
        // Given - the package's own tree, and one with a driver of every sibling kind and an adapter
        const drifted = treeOf({
            'src/clock/clock.driver.browser.ts': '',
            'src/clock/clock.driver.fixtures.ts': '',
            'src/clock/clock.driver.test-d.ts': '',
            'src/clock/clock.driver.test.ts': '',
            'src/clock/clock.driver.ts': '',
            'src/clock/process-clock.adapter.ts': '',
            'src/stubs/page/page.driver.tsx': '',
        });

        // Then - the package holds none; each driver is named at itself with its own sibling kind and extension, the adapter left alone
        expect(checkOneWordForAnAdapter(ROOT)).toStrictEqual([]);
        expect(
            checkOneWordForAnAdapter(drifted).map(
                ({ fix, found, line, path }) => `${path}:${line} ${found} | ${fix}`,
            ),
        ).toStrictEqual([
            "src/clock/clock.driver.browser.ts:1 `clock.driver.browser.ts` carries the suffix `.driver`, a second word for an adapter | rename it `<what it adapts>.adapter.browser.ts` — the process clock's is `process-clock.adapter.ts` — and the paths that import it",
            "src/clock/clock.driver.fixtures.ts:1 `clock.driver.fixtures.ts` carries the suffix `.driver`, a second word for an adapter | rename it `<what it adapts>.adapter.fixtures.ts` — the process clock's is `process-clock.adapter.ts` — and the paths that import it",
            "src/clock/clock.driver.test-d.ts:1 `clock.driver.test-d.ts` carries the suffix `.driver`, a second word for an adapter | rename it `<what it adapts>.adapter.test-d.ts` — the process clock's is `process-clock.adapter.ts` — and the paths that import it",
            "src/clock/clock.driver.test.ts:1 `clock.driver.test.ts` carries the suffix `.driver`, a second word for an adapter | rename it `<what it adapts>.adapter.test.ts` — the process clock's is `process-clock.adapter.ts` — and the paths that import it",
            "src/clock/clock.driver.ts:1 `clock.driver.ts` carries the suffix `.driver`, a second word for an adapter | rename it `<what it adapts>.adapter.ts` — the process clock's is `process-clock.adapter.ts` — and the paths that import it",
            "src/stubs/page/page.driver.tsx:1 `page.driver.tsx` carries the suffix `.driver`, a second word for an adapter | rename it `<what it adapts>.adapter.tsx` — the process clock's is `process-clock.adapter.ts` — and the paths that import it",
        ]);
    });

    test('one-word-for-an-adapter — a module implementing a port carries the suffix `.adapter`', () => {
        // Given - a class, an annotated object and a `satisfies` object implementing the port outside an adapter module, beside an adapter and a module typed by the port's value type
        const port = "import type { ClockPort } from './clock.port.js';\n";
        const drifted = treeOf({
            'src/clock/clock.port.ts':
                'export interface ClockPort { now(): number }\nexport type Reading = { at: number };\n',
            'src/clock/fixed-clock.ts': `${port}export class FixedClock implements ClockPort { now() { return 0; } }\n`,
            'src/clock/frozen-clock.ts': `${port}export const frozenClock: ClockPort = { now: () => 0 };\n`,
            'src/clock/process-clock.adapter.ts': `${port}export const processClock: ClockPort = { now: () => Date.now() };\n`,
            'src/clock/reading.ts':
                "import type { Reading } from './clock.port.js';\nexport const reading: Reading = { at: 0 };\n",
            'src/clock/still-clock.ts': `${port}export const stillClock = { now: () => 0 } satisfies ClockPort;\n`,
        });

        // Then - each implementation outside an adapter module is named at itself; the adapter and the value type are left alone
        expect(located(checkOneWordForAnAdapter(drifted))).toStrictEqual([
            'src/clock/fixed-clock.ts:2:8 one-word-for-an-adapter: `fixed-clock.ts` implements `ClockPort` without the suffix `.adapter`',
            'src/clock/frozen-clock.ts:2:14 one-word-for-an-adapter: `frozen-clock.ts` implements `ClockPort` without the suffix `.adapter`',
            'src/clock/still-clock.ts:2:27 one-word-for-an-adapter: `still-clock.ts` implements `ClockPort` without the suffix `.adapter`',
        ]);
    });
});
