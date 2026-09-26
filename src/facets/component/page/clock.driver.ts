import type { ClockPort } from '../../../world/clock/clock.port.js';
import { afterThisTest, pinClock, providedClock, releaseClock } from './page-runtime.js';

/** The chain's instant wins over `component({ clock })`'s; `Date` stays pinned for the rest of the test, since a mounted component keeps running. */
export const pageClock: ClockPort = {
    pin: (iso) => {
        const instant = iso ?? providedClock();
        if (instant !== undefined) {
            pinClock(instant);
        }
        afterThisTest(releaseClock);
        return {};
    },
};
