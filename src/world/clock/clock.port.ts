import type { Armed } from '../../kernel/chain/capability.js';

/** The calendar a chain pins — the only way `.clock()` reaches its subject. */
export type ClockPort = {
    /**
     * Pin the subject's `Date` at `iso` until the effect is released. A
     * stated `iso` is an instant: the capability refused anything else before
     * the engine sees it. Handed `null` when the chain stated none: the
     * engine pins the default its subject has, or nothing.
     */
    readonly pin: (iso: null | string) => Armed | undefined;
};
