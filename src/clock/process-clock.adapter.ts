import type { Armed } from '../chain/capability.js';
import { clock } from './clock.js';
import type { ClockPort } from './clock.port.js';

function pinnedAt(iso: string): Armed {
    const pinned = clock.at(iso);
    return {
        release: () => {
            pinned[Symbol.dispose]();
        },
    };
}

export const processClock: ClockPort = {
    pin: (iso) => (iso === null ? undefined : pinnedAt(iso)),
};
