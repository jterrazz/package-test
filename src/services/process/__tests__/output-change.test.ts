import { describe, expect, test, vi } from 'vitest';

import { clock } from '../../../clock/clock.js';
import { OutputChange } from '../output-change.js';

const NOW = '2026-01-02T03:04:05.000Z';

describe('OutputChange', () => {
    test('a waiter wakes on the next change and leaves no timer behind', async () => {
        // Given - the scheduler pinned, and a change no one waits for yet
        using _ = clock.run(NOW);
        const change = new OutputChange();
        change.notify();

        // When - a wait with a far deadline, then a change
        const waited = change.next(30_000);
        change.notify();
        await waited;

        // Then - it woke with no time passing, and its deadline is no longer pending
        expect(vi.getTimerCount()).toBe(0);
    });

    test('a waiter no change reaches wakes at its deadline, and not a millisecond before', async () => {
        // Given - the scheduler pinned, and a wait of one second
        using _ = clock.run(NOW);
        const change = new OutputChange();
        let woken = false;
        const waited = (async (): Promise<void> => {
            await change.next(1000);
            woken = true;
        })();

        // When - the clock reaches just before the deadline, then the deadline
        await clock.advance(999);
        const early = woken;
        await clock.advance(1);
        await waited;

        // Then - it was still waiting a millisecond early, and woke at the deadline
        expect([early, woken]).toStrictEqual([false, true]);
    });
});
