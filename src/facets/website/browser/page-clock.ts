import type { Armed } from '../../../kernel/chain/capability.js';

/**
 * The calendar of the PAGE a website chain visits. The site runs in its own
 * process and its scripts read the browser's clock, so the instant travels
 * with the visit (`BrowserOpenOptions.clock`): arming the chain pins nothing
 * in this process.
 */
export const pageClock: { readonly pin: (iso: string) => Armed } = {
    pin: () => ({}),
};
