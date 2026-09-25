import { defineCapability } from '../../../kernel/chain/capability.js';
import type { ChainSignature } from '../../../kernel/chain/capability.js';
import type { ComponentUi } from './scenario.js';

type Wrapper = (ui: ComponentUi) => ComponentUi;

export type WrapMethod<Self> = (wrapper: Wrapper) => Self;

export type WrapChain<Self> = {
    /** Wrap every render of this chain; the project's `wrap` stays outermost. */
    wrap: WrapMethod<Self>;
};

// oxlint-disable-next-line typescript/consistent-type-definitions -- a signature is read through `this`, which only an interface can name
export interface WrapSignature extends ChainSignature {
    readonly chain: WrapChain<this['self']>;
}

/** A later call replaces an earlier one: the wrappers do not nest. */
export const wrap = defineCapability<'wrap', null | Wrapper, [wrapper: Wrapper], WrapSignature>({
    initial: null,
    name: 'wrap',
    phase: 30,
    reduce: (_stated, [wrapper]) => wrapper,
    row: { group: 'Setup', name: '.wrap()', probe: '.wrap(' },
});
