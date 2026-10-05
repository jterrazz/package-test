import { defineCapability } from '../../../chain/capability.js';
import type { ChainSignature } from '../../../chain/capability.js';
import type { ViewportPort } from './viewport.port.js';

type Size = { height: number; width: number };

export type ViewportMethod<Self> = (size: Size) => Self;

export type ViewportChain<Self> = {
    /** The page size this render gets; the project's size is restored when the test ends. */
    viewport: ViewportMethod<Self>;
};

export interface ViewportSignature extends ChainSignature {
    readonly chain: ViewportChain<this['self']>;
}

/** A chain stating none leaves the page at the project's size, unresized. */
export const viewport = defineCapability<
    'viewport',
    null | Size,
    [size: Size],
    ViewportSignature,
    { viewport: ViewportPort }
>({
    arm: async (size, adapters) => (size === null ? undefined : await adapters.viewport.size(size)),
    initial: null,
    name: 'viewport',
    phase: 30,
    reduce: (_stated, [size]) => size,
    row: { group: 'Setup', name: '.viewport()', probe: '.viewport(' },
});
