import type { ClockPort } from '../../../world/clock/clock.port.js';

/** The site's scripts read the browser's clock: the instant travels with the visit, nothing is pinned in this process. */
export const pageClock: ClockPort = {
    pin: () => ({}),
};
