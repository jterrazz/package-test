import type { Armed } from '../../model/chain/capability.js';
import { clock } from '../../model/clock/clock.js';

/**
 * The calendar of THIS process — what an in-process subject (an app, a job,
 * a module) reads. Pinned through the one time primitive, so an instant that
 * is not one is refused in its words, and released when the action settles.
 */
export const processClock: { readonly pin: (iso: string) => Armed } = {
    pin: (iso) => {
        const pinned = clock.at(iso);
        return {
            release: () => {
                pinned[Symbol.dispose]();
            },
        };
    },
};
