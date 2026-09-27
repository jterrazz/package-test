import type { Armed } from '../../kernel/chain/capability.js';

export type ClockPort = {
    /** Handed `null` when the chain stated none: the adapter pins its subject's default, or nothing. */
    readonly pin: (iso: null | string) => Armed | undefined;
};
