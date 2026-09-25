import { pause } from '../../kernel/pause.js';

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

/** Wait until a condition holds; measured on `performance.now()`, so `clock.at()` cannot freeze the deadline. */
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
        if (performance.now() >= deadline) {
            throw new Error(
                `waitUntil(): ${options.why ?? 'the condition'} did not hold within ${timeout}ms. ` +
                    'Raise the budget if the wait is legitimate, or wait on what actually changes.',
            );
        }
        await pause(interval);
    }
}
