import type { Armed } from '../../model/chain/capability.js';

/** The calendar a chain pins — the only way `.clock()` reaches its subject. */
export type ClockPort = {
    /** Pin the subject's `Date` at `iso` until the effect is released; refuse what is not an instant. */
    readonly pin: (iso: string) => Armed;
};
