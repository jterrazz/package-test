import { pause } from '../timing/pause.js';

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

/**
 * Wait until a condition holds — the sanctioned answer to "the thing I am
 * specifying is not ready yet".
 *
 * A spec that sleeps for a guessed duration is a spec that is slow on a fast
 * machine and flaky on a slow one, which is why J2 refuses `setTimeout` under
 * `specs/`. Every facet that drives something already waits on a CONDITION —
 * a served page, a banner on stdout, an element the visitor can see — and this
 * is that primitive where no facet owns the waiting: a background write to
 * land, a queue to drain, a file to appear.
 *
 * The failure names the condition and how long it was given, so a timeout is a
 * sentence rather than "expected true, got false".
 *
 * Not for a subject under `clock.run()`: there the scheduler is the test's, and
 * `clock.advance(ms)` is what makes time pass.
 *
 * @example
 *   await waitUntil(() => outbox.length === 1, { why: 'the job wrote its one message' });
 */
export async function waitUntil(
    predicate: () => boolean | Promise<boolean>,
    options: WaitUntilOptions = {},
): Promise<void> {
    const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
    const interval = options.interval ?? DEFAULT_INTERVAL_MS;
    const deadline = Date.now() + timeout;
    for (;;) {
        if (await predicate()) {
            return;
        }
        if (Date.now() >= deadline) {
            throw new Error(
                `waitUntil(): ${options.why ?? 'the condition'} did not hold within ${timeout}ms. ` +
                    'Raise the budget if the wait is legitimate, or wait on what actually changes.',
            );
        }
        await pause(interval);
    }
}
