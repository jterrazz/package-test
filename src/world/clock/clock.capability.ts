import { defineCapability } from '../../kernel/chain/capability.js';
import type { ChainSignature } from '../../kernel/chain/capability.js';
import type { ClockPort } from './clock.port.js';
import { instantOf } from './instant.js';

/** `.clock(iso)`, handing back the chain it was called on. */
export type ClockMethod<Self> = (iso: string) => Self;

/** What `.clock()` puts on a chain, handing back the chain it was called on. */
export type ClockChain<Self> = {
    /**
     * Pin `Date` at `iso` for this chain: this process's own for an app, a job
     * or a module run in it, the page's for a visit or a render.
     */
    clock: ClockMethod<Self>;
};

/** The signature `ChainOf` reads off `clock`. */
// oxlint-disable-next-line typescript/consistent-type-definitions -- a signature is read through `this`, which only an interface can name
export interface ClockSignature extends ChainSignature {
    readonly chain: ClockChain<this['self']>;
}

/**
 * `.clock(iso)`: the instant the subject's calendar reads for this chain. The
 * instant is taken as written and judged here when the chain is armed, before
 * any engine sees it, so every calendar refuses what is not an instant in the
 * same words; the engine pins it, and it is released when the action settles,
 * so a chain never leaks its instant into the next one (CONVENTIONS D16). A
 * chain that states none hands the engine `null`: the engine pins the default
 * its subject has, or nothing.
 */
export const clock = defineCapability<
    'clock',
    null | string,
    [iso: string],
    ClockSignature,
    { clock: ClockPort },
    'clock'
>({
    arm: (instant, engines) => {
        if (instant !== null) {
            instantOf('at', instant);
        }
        return engines.clock.pin(instant);
    },
    context: 'clock',
    initial: null,
    name: 'clock',
    phase: 50,
    reduce: (_pinned, [iso]) => iso,
    row: { group: 'Setup', name: '.clock()', probe: '.clock(' },
});
