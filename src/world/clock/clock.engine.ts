import type { Armed } from '../../kernel/chain/capability.js';
import { clock } from './clock.js';
import type { ClockPort } from './clock.port.js';

/** The process's `Date` pinned at `iso`, until the effect is released. */
function pinnedAt(iso: string): Armed {
    const pinned = clock.at(iso);
    return {
        release: () => {
            pinned[Symbol.dispose]();
        },
    };
}

/**
 * The calendar of THIS process — what an in-process subject (an app, a job,
 * a module) reads. Pinned through the one time primitive, so an instant that
 * is not one is refused in its words, and released when the action settles;
 * a chain that states none leaves the process its real calendar.
 */
export const processClock: ClockPort = {
    pin: (iso) => (iso === null ? undefined : pinnedAt(iso)),
};
