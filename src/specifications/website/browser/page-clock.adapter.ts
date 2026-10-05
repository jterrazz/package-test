import type { ClockPort } from '../../../clock/clock.port.js';

/** The site's scripts read the browser's clock: the instant travels with the visit, nothing is pinned in this process. */
export const pageClock: ClockPort = {
    pin: () => ({}),
};
