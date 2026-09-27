import { defineCapability } from '../../kernel/chain/capability.js';
import type { ChainSignature } from '../../kernel/chain/capability.js';
import type { ClockPort } from './clock.port.js';
import { instantOf } from './instant.js';

export type ClockMethod<Self> = (iso: string) => Self;

export type ClockChain<Self> = {
    /** Pin `Date` at `iso` for this chain: this process's for an app, job or module, the page's for a visit or a render. */
    clock: ClockMethod<Self>;
};

// oxlint-disable-next-line typescript/consistent-type-definitions -- a signature is read through `this`, which only an interface can name
export interface ClockSignature extends ChainSignature {
    readonly chain: ClockChain<this['self']>;
}

/** The instant is judged here, before any adapter sees it, and released when the action settles (`no-sampled-value-in-expectation`); a chain stating none hands the adapter `null`. */
export const clock = defineCapability<
    'clock',
    null | string,
    [iso: string],
    ClockSignature,
    { clock: ClockPort },
    'clock'
>({
    arm: (instant, drivers) => {
        if (instant !== null) {
            instantOf('at', instant);
        }
        return drivers.clock.pin(instant);
    },
    context: 'clock',
    initial: null,
    name: 'clock',
    phase: 50,
    reduce: (_pinned, [iso]) => iso,
    row: { group: 'Setup', name: '.clock()', probe: '.clock(' },
});
