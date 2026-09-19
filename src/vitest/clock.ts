import { vi } from 'vitest';

/**
 * The one time primitive.
 *
 * Time is the determinism the framework owns (CONVENTIONS D16): a test that
 * samples `Date.now()` and asserts on what comes back is a test that fails on
 * the next leap second, and a test that reaches for `vi.useFakeTimers()` owns a
 * teardown it will one day forget. `clock` is both answers in one name — the
 * instant is stated, and the scope restores itself.
 *
 * ```typescript
 * using _ = clock.at('2026-03-04T09:30:00Z');   // Date is pinned until the scope ends
 * ```
 *
 * `at()` takes the CALENDAR and leaves the scheduler alone: a UI framework's
 * own loop, a `setTimeout` inside the subject and every promise still resolve
 * on their own. `run()` takes the scheduler too, for a subject whose behaviour
 * IS the passage of time — a debounce, a retry backoff, a poll.
 */

/** A pinned clock — released when the `using` scope that declared it ends. */
export type PinnedClock = Disposable;

/** The instant `iso` names, or a refusal that says what an instant looks like. */
function instantOf(method: string, iso: string): Date {
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) {
        throw new TypeError(
            `clock.${method}(): "${iso}" is not an instant — pass an ISO-8601 string ` +
                `(e.g. '2026-03-04T09:30:00Z').`,
        );
    }
    return at;
}

/**
 * One clock per test — a second one taken inside the first is refused rather
 * than nested.
 *
 * Disposing gives the REAL clock back, which is the only thing vitest's fake
 * timers can restore: the instant, the `toFake` set and the queue a previous
 * scope held are not readable, so an inner scope that ended would silently end
 * the outer one too. A refusal says which of the two the test meant.
 */
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
    /**
     * Move the pinned clock forward by `ms` — and, under {@link clock.run},
     * fire every callback that came due, awaiting what each of them started.
     *
     * Only a pinned clock moves: called with no clock taken, it says so rather
     * than silently doing nothing to the real one.
     */
    async advance(ms: number): Promise<void> {
        if (!vi.isFakeTimers()) {
            throw new Error(
                'clock.advance(): no clock is pinned — take one first with ' +
                    "`using _ = clock.at('<iso>')` (the calendar) or `using _ = clock.run()` (the scheduler).",
            );
        }
        await vi.advanceTimersByTimeAsync(ms);
    },

    /**
     * Pin `Date` at `iso` for the current scope. `Date` ONLY: the scheduler
     * stays real, so a subject that awaits, renders or polls keeps running.
     *
     * @example
     *   using _ = clock.at('2026-03-04T09:30:00Z');
     *   expect(stampedAt()).toBe('2026-03-04T09:30:00.000Z');
     */
    at(iso: string): PinnedClock {
        return take('at', { now: instantOf('at', iso), toFake: ['Date'] });
    },

    /**
     * Take the scheduler as well as the calendar: `setTimeout`, `setInterval`
     * and their friends queue instead of firing, and {@link clock.advance} is
     * what makes them due. For a subject whose behaviour IS elapsed time — a
     * debounce, a retry backoff, a poll — where waiting for real would be the
     * arbitrary sleep J2 forbids.
     *
     * @example
     *   using _ = clock.run('2026-03-04T09:30:00Z');
     *   const pending = retrying(failsTwice);
     *   await clock.advance(5_000);
     *   await expect(pending).resolves.toBe('ok');
     */
    run(iso?: string): PinnedClock {
        return take('run', iso === undefined ? {} : { now: instantOf('run', iso) });
    },
};
