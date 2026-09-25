import { vi } from 'vitest';

import { instantOf } from './instant.js';

/** The one time primitive (D16): `at()` pins the calendar, `run()` the scheduler too. */

/** A pinned clock — released when the `using` scope that declared it ends. */
export type PinnedClock = Disposable;

/** One clock per test: vitest's fake timers restore only the real clock, so a nested scope ending would end the outer one too. */
function take(method: string, options: Parameters<typeof vi.useFakeTimers>[0]): PinnedClock {
    if (vi.isFakeTimers()) {
        throw new Error(
            `clock.${method}(): a clock is already pinned — one scope per test. ` +
                'End the first scope before taking another, or state the instant on the ' +
                'chain (`.clock(iso)`) rather than around it.',
        );
    }
    vi.useFakeTimers(options);
    return {
        [Symbol.dispose]: () => {
            vi.useRealTimers();
        },
    };
}

export const clock = {
    /** Move the pinned clock forward; under `clock.run` fire what came due. Refused with no clock taken. */
    async advance(ms: number): Promise<void> {
        if (!vi.isFakeTimers()) {
            throw new Error(
                'clock.advance(): no clock is pinned — take one first with ' +
                    "`using _ = clock.at('<iso>')` (the calendar) or `using _ = clock.run()` (the scheduler).",
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
