import { describe, expect, test } from 'vitest';

import { clock } from '../../clock/clock.js';
import { pause, untilDeadline } from '../pause.js';

describe('pause', () => {
    test('untilDeadline — a probe asked until it answers — hands back the first answer that is not undefined', async () => {
        // Given - a probe that answers on its third ask
        let asked = 0;
        const probe = (): string | undefined => {
            asked += 1;
            return asked === 3 ? 'ready' : undefined;
        };

        // When - it is asked within a generous budget
        const answer = await untilDeadline(probe, { interval: 1, timeout: 5000 });

        // Then - the answer, after three asks
        expect([answer, asked]).toStrictEqual(['ready', 3]);
    });

    test('untilDeadline — a probe asked until it answers — answers undefined once the budget is spent, under a pinned calendar too', async () => {
        // Given - the calendar pinned, and a probe that never answers
        using _ = clock.at('2026-10-21T10:00:00.000Z');
        let asked = 0;
        const never = (): string | undefined => {
            asked += 1;
            return undefined;
        };

        // When - it is asked within 50 ms, every 5 ms
        const answer = await untilDeadline(never, { interval: 5, timeout: 50 });

        // Then - nothing, after more than one ask: the budget passed though the calendar stood still
        expect([answer, asked > 1]).toStrictEqual([undefined, true]);
    });

    test('untilDeadline — a probe asked until it answers — waits on what it is handed between two asks, told the time left', async () => {
        // Given - a wait that records what it is told
        const told: number[] = [];
        let asked = 0;

        // When - a probe answers on its second ask
        await untilDeadline(
            () => {
                asked += 1;
                return asked === 2 ? true : undefined;
            },
            {
                timeout: 1000,
                wait: async (remaining) => {
                    told.push(remaining);
                    await pause(1);
                },
            },
        );

        // Then - one wait, told a time left within the budget
        expect(told.map((remaining) => remaining > 0 && remaining <= 1000)).toStrictEqual([true]);
    });
});
