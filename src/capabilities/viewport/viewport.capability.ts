import { defineCapability } from '../../model/chain/capability.js';
import type { ViewportPort } from './viewport.port.js';

/** The page size a render gets. */
type Size = { height: number; width: number };

/** `.viewport(size)`, handing back the chain it was called on. */
export type ViewportMethod<Self> = (size: Size) => Self;

/**
 * `.viewport(size)`: the page size THIS render gets. A later call replaces an
 * earlier one; a chain that states none leaves the page at the project's
 * size, and its engine never resizes it.
 */
export const viewport = defineCapability<
    'viewport',
    null | Size,
    [size: Size],
    { viewport: ViewportPort }
>({
    arm: async (size, engines) => (size === null ? undefined : await engines.viewport.size(size)),
    initial: null,
    name: 'viewport',
    phase: 30,
    reduce: (_stated, [size]) => size,
    row: { group: 'Setup', name: '.viewport()', probe: '.viewport(' },
});
