import type { Armed } from '../../model/chain/capability.js';
import { afterThisTest, pinClock, providedClock, releaseClock } from './page-runtime.js';

/**
 * The calendar of the PAGE — what a mounted component reads. The chain's
 * instant wins over the one `component({ clock })` provides; `Date` stays
 * pinned for the rest of the test, because a mounted component keeps running
 * after its render resolves, and the page gets its real clock back when the
 * test ends. An instant that is not one is refused when the chain is armed.
 */
export const pageClock: { readonly pin: (iso: null | string) => Armed } = {
    pin: (iso) => {
        const instant = iso ?? providedClock();
        if (instant !== undefined) {
            pinClock(instant);
        }
        afterThisTest(releaseClock);
        return {};
    },
};
