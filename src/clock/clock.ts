import { vi } from 'vitest';

import { refusal } from '../chain/refusals/refusal.js';
import { instantOf } from './instant.js';

/** A pinned clock — released when the `using` scope that declared it ends. */
export type PinnedClock = Disposable;

/** One clock per test: vitest's fake timers restore only the real clock, so a nested scope ending would end the outer one too. */
function take(method: string, options: Parameters<typeof vi.useFakeTimers>[0]): PinnedClock {
    if (vi.isFakeTimers()) {
        throw new Error(
            refusal({
                fix: 'end the first scope before taking another, or state the instant on the chain (`.clock(iso)`) rather than around it',
                found: `clock.${method}(), and a clock is already pinned`,
                read: 'docs/19-time-and-doubles.md#the-clock',
                why: 'One clock per test: ending a nested scope would end the outer one too.',
            }),
        );
    }
    vi.useFakeTimers(options);
    return {
        [Symbol.dispose]: () => {
            vi.useRealTimers();
        },
    };
}

/** The one time primitive (`no-sampled-value-in-expectation`): `at()` pins the calendar, `run()` the scheduler too. */
export const clock = {
    /** Move the pinned clock forward; under `clock.run` fire what came due. Refused with no clock taken. */
    async advance(ms: number): Promise<void> {
        if (!vi.isFakeTimers()) {
            throw new Error(
                refusal({
                    fix: "take one first: `using _ = clock.at('<iso>')` (the calendar) or `using _ = clock.run()` (the scheduler)",
                    found: 'clock.advance(), and no clock is pinned',
                    read: 'docs/19-time-and-doubles.md#the-clock',
                    why: 'Only a pinned clock moves: the real one holds no time of the test’s to advance.',
                }),
            );
        }
        await vi.advanceTimersByTimeAsync(ms);
    },

    /** Pin `Date` at `iso` for the current scope; the scheduler stays real. */
    at(iso: string): PinnedClock {
        return take('at', { now: instantOf('at', iso), toFake: ['Date'] });
    },

    /** Take the scheduler as well as the calendar; `clock.advance` makes timers due. */
    run(iso?: string): PinnedClock {
        return take('run', iso === undefined ? {} : { now: instantOf('run', iso) });
    },
};
