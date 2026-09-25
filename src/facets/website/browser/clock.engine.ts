import type { ClockPort } from '../../../world/clock/clock.port.js';

/**
 * The calendar of the PAGE a website chain visits. The site runs in its own
 * process and its scripts read the browser's clock, so the instant travels
 * with the visit (`BrowserOpenOptions.clock`): arming the chain pins nothing
 * in this process.
 */
export const pageClock: ClockPort = {
    pin: () => ({}),
};
