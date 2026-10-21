export async function pause(ms: number): Promise<void> {
    // hazard: a pause of nothing schedules no timer: under a test's stopped scheduler (`clock.run()`) it would never fire.
    if (ms <= 0) {
        return;
    }
    await new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });
}

export type DeadlineOptions = {
    /** Milliseconds between two asks, when no `wait` is given. */
    interval?: number;
    /** Milliseconds the probe has to answer. */
    timeout: number;
    /** What to wait on between two asks, handed the milliseconds left: a pause of `interval` by default. */
    wait?: (remaining: number) => Promise<void>;
};

/** Asks `probe` until it answers something other than `undefined`, which it hands back, or answers `undefined` once `timeout` has passed. Measured on `performance.now()`, so `clock.at()`, which fakes `Date`, cannot freeze it. */
export async function untilDeadline<Answer>(
    probe: () => Answer | Promise<Answer | undefined> | undefined,
    { interval = 0, timeout, wait }: DeadlineOptions,
): Promise<Answer | undefined> {
    const deadline = performance.now() + timeout;
    for (;;) {
        const answer = await probe();
        if (answer !== undefined) {
            return answer;
        }
        const remaining = deadline - performance.now();
        // Stryker disable next-line EqualityOperator: the deadline is not met to the microsecond
        if (remaining <= 0) {
            return undefined;
        }
        await (wait === undefined ? pause(interval) : wait(remaining));
    }
}
