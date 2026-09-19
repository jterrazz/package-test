import { describe, expect, test } from 'vitest';

import { clock } from '../../vitest/clock.js';
import { waitUntil } from './wait-until.js';

describe('waitUntil — waiting on a condition, never on a duration', () => {
    test('returns as soon as the condition holds', async () => {
        // Given - a condition that becomes true on the third reading
        let readings = 0;
        await waitUntil(
            () => {
                readings += 1;
                return readings === 3;
            },
            { interval: 1 },
        );

        // Then - it stopped there rather than waiting out the budget
        expect(readings).toBe(3);
    });

    test('takes an asynchronous reading', async () => {
        // Given - a condition read through a promise
        let landed = false;
        // oxlint-disable-next-line jterrazz/j2-no-sleep-in-specs -- the subject IS the wait primitive: this timer is the test's Given (the condition landing later), not a synchronisation step standing in for `waitUntil`
        setTimeout(() => {
            landed = true;
        }, 5);

        // Then - the poll awaits each reading
        await waitUntil(async () => await Promise.resolve(landed), { interval: 1 });
        expect(landed).toBe(true);
    });

    test('names the condition and the budget when it runs out', async () => {
        // Given - a condition that never holds, on a short budget
        // Then - the timeout is a sentence
        await expect(
            waitUntil(() => false, {
                interval: 1,
                timeout: 10,
                why: 'the outbox held one message',
            }),
        ).rejects.toThrow('the outbox held one message did not hold within 10ms');
    });

    test('times out with its own sentence under a pinned calendar', async () => {
        // Given - a frozen `Date`, which a deadline read off the calendar
        // Would never pass: the poll would run until vitest killed the file
        using _ = clock.at('2026-03-04T09:30:00Z');

        // Then - the budget is the condition's, not the calendar's
        await expect(
            waitUntil(() => false, { interval: 1, timeout: 10, why: 'the queue drained' }),
        ).rejects.toThrow('the queue drained did not hold within 10ms');
    });
});
