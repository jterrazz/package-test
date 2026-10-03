import { describe, expect, test } from 'vitest';

import { clock } from './clock.capability.js';
import type { ClockPort } from './clock.port.js';

/** A port that logs each instant it is handed. */
function pinning(log: (null | string)[]): { clock: ClockPort } {
    return {
        clock: {
            pin: (iso) => {
                log.push(iso);
                return {};
            },
        },
    };
}

const RUN = { config: {}, testDir: '/spec', workDir: null };

describe('clock', () => {
    test('clock.capability — .clock() — the chain’s last instant is handed to the adapter, and none when it stated none', async () => {
        // Given - a chain pinning twice, and one pinning nothing
        const log: (null | string)[] = [];
        const setup = { adapters: pinning(log), config: {} };
        const stated = clock.reduce(
            clock.reduce(clock.initial, ['2026-01-01T00:00:00Z'], setup),
            ['2026-03-04T09:30:00Z'],
            setup,
        );

        // When - each arms
        await clock.arm?.(stated, pinning(log), RUN);
        await clock.arm?.(clock.initial, pinning(log), RUN);

        // Then - the last instant stated, then none
        expect(log).toStrictEqual(['2026-03-04T09:30:00Z', null]);
    });

    test('clock.capability — .clock() — an instant that is none is refused before the adapter sees it, in the words the chain wrote', async () => {
        // Given - a chain pinned at a word
        const log: (null | string)[] = [];

        // When - it arms
        const arming = async (): Promise<unknown> => await clock.arm?.('soon', pinning(log), RUN);

        // Then - refused, and nothing pinned
        await expect(arming()).rejects.toThrow(
            new TypeError(
                [
                    'found: .clock("soon"), and "soon" is not an instant',
                    'why: A clock is pinned at an instant, written as an ISO-8601 string.',
                    "fix: pass an ISO-8601 string: .clock('2026-03-04T09:30:00Z')",
                    'read: docs/19-time-and-doubles.md#the-clock',
                ].join('\n'),
            ),
        );
        expect(log).toStrictEqual([]);
    });
});
