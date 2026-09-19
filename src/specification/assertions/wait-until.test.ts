import { describe, expect, test } from 'vitest';

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
});
