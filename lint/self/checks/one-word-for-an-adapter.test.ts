import { describe, expect, test } from 'vitest';

import { located, ROOT, treeOf } from '../../engine/testing/source.fixtures.js';
import { checkOneWordForAnAdapter } from './one-word-for-an-adapter.js';

describe('checkOneWordForAnAdapter', () => {
    test('one-word-for-an-adapter — a module that adapts a port is a `*.adapter.ts`, never a `*.driver.ts`', () => {
        // Given - the package's own tree, and one with a driver, its test, its fixtures and an adapter
        const drifted = treeOf({
            'src/world/clock/clock.driver.fixtures.ts': '',
            'src/world/clock/clock.driver.test.ts': '',
            'src/world/clock/clock.driver.ts': '',
            'src/world/clock/process-clock.adapter.ts': '',
        });

        // Then - the package holds none; each driver is named at itself, the adapter left alone
        expect(checkOneWordForAnAdapter(ROOT)).toStrictEqual([]);
        expect(located(checkOneWordForAnAdapter(drifted))).toStrictEqual([
            'src/world/clock/clock.driver.fixtures.ts:1:1 one-word-for-an-adapter: `clock.driver.fixtures.ts` carries the suffix `.driver`, a second word for an adapter',
            'src/world/clock/clock.driver.test.ts:1:1 one-word-for-an-adapter: `clock.driver.test.ts` carries the suffix `.driver`, a second word for an adapter',
            'src/world/clock/clock.driver.ts:1:1 one-word-for-an-adapter: `clock.driver.ts` carries the suffix `.driver`, a second word for an adapter',
        ]);
    });
});
