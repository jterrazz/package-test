import { pause } from '../../chain/pause.js';
import { refusal } from '../../chain/refusals/refusal.js';

/** How long to wait, and how often to look. */
export type WaitUntilOptions = {
    /** Milliseconds between two readings. Default 50. */
    interval?: number;
    /** How long the condition has to become true. Default 5 000 ms. */
    timeout?: number;
    /** What the condition is, named in the failure. Default: the predicate's source. */
    why?: string;
};

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_INTERVAL_MS = 50;

/** Wait until a condition holds; measured on `performance.now()`, so `clock.at()` cannot freeze it. Under `clock.run()` it never wakes: use `clock.advance()`. */
export async function waitUntil(
    predicate: () => boolean | Promise<boolean>,
    options: WaitUntilOptions = {},
): Promise<void> {
    const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
    const interval = options.interval ?? DEFAULT_INTERVAL_MS;
    const deadline = performance.now() + timeout;
    for (;;) {
        if (await predicate()) {
            return;
        }
        // Stryker disable next-line EqualityOperator: the deadline is not met to the microsecond
        if (performance.now() >= deadline) {
            throw new Error(
                refusal({
                    fix: 'raise the budget if the wait is legitimate, or wait on what actually changes',
                    found: `waitUntil(): ${options.why ?? 'the condition'} did not hold within ${timeout}ms`,
                    read: 'docs/reference/assertions.md#two-helpers-that-are-not-matchers',
                    why: '`waitUntil()` waits on a condition, within a budget.',
                }),
            );
        }
        await pause(interval);
    }
}
