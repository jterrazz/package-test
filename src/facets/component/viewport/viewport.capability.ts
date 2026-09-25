import { defineCapability } from '../../../kernel/chain/capability.js';
import type { ChainSignature } from '../../../kernel/chain/capability.js';
import type { ViewportPort } from './viewport.port.js';

/** The page size a render gets. */
type Size = { height: number; width: number };

/** `.viewport(size)`, handing back the chain it was called on. */
export type ViewportMethod<Self> = (size: Size) => Self;

/** What `.viewport()` puts on a chain, handing back the chain it was called on. */
export type ViewportChain<Self> = {
    /**
     * The page size THIS render gets — the Given of a component that reads
     * `matchMedia` or a container query. The project's size is restored when
     * the test ends, so a narrow render never leaks into the next one.
     */
    viewport: ViewportMethod<Self>;
};

/** The signature `ChainOf` reads off `viewport`. */
// oxlint-disable-next-line typescript/consistent-type-definitions -- a signature is read through `this`, which only an interface can name
export interface ViewportSignature extends ChainSignature {
    readonly chain: ViewportChain<this['self']>;
}

/**
 * `.viewport(size)`: the page size THIS render gets. A later call replaces an
 * earlier one; a chain that states none leaves the page at the project's
 * size, and its engine never resizes it.
 */
export const viewport = defineCapability<
    'viewport',
    null | Size,
    [size: Size],
    ViewportSignature,
    { viewport: ViewportPort }
>({
    arm: async (size, engines) => (size === null ? undefined : await engines.viewport.size(size)),
    initial: null,
    name: 'viewport',
    phase: 30,
    reduce: (_stated, [size]) => size,
    row: { group: 'Setup', name: '.viewport()', probe: '.viewport(' },
});
