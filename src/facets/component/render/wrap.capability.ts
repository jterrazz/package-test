import { defineCapability } from '../../../kernel/chain/capability.js';
import type { ChainSignature } from '../../../kernel/chain/capability.js';
import type { ComponentUi } from '../page/ui.js';

/** What dresses a React tree before it is mounted. */
type Wrapper = (ui: ComponentUi) => ComponentUi;

/** `.wrap(wrapper)`, handing back the chain it was called on. */
export type WrapMethod<Self> = (wrapper: Wrapper) => Self;

/** What `.wrap()` puts on a chain, handing back the chain it was called on. */
export type WrapChain<Self> = {
    /**
     * Wrap every render of this chain — the test-local Given a router stub or
     * a `<StrictMode>` is. The project's own `wrap` stays outermost: it is the
     * app's frame, and one test does not get to sit outside it.
     */
    wrap: WrapMethod<Self>;
};

/** The signature `ChainOf` reads off `wrap`. */
// oxlint-disable-next-line typescript/consistent-type-definitions -- a signature is read through `this`, which only an interface can name
export interface WrapSignature extends ChainSignature {
    readonly chain: WrapChain<this['self']>;
}

/**
 * `.wrap(wrapper)`: the test-local frame every render of this chain is
 * dressed in. A later call replaces an earlier one — the wrappers do not
 * nest. It arms nothing: the render reads it when it mounts.
 */
export const wrap = defineCapability<'wrap', null | Wrapper, [wrapper: Wrapper], WrapSignature>({
    initial: null,
    name: 'wrap',
    phase: 30,
    reduce: (_stated, [wrapper]) => wrapper,
    row: { group: 'Setup', name: '.wrap()', probe: '.wrap(' },
});
