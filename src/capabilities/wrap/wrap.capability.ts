import { defineCapability } from '../../model/chain/capability.js';
import type { ComponentUi } from '../../seams/vitest-browser/ui.js';

/** What dresses a React tree before it is mounted. */
type Wrapper = (ui: ComponentUi) => ComponentUi;

/** `.wrap(wrapper)`, handing back the chain it was called on. */
export type WrapMethod<Self> = (wrapper: Wrapper) => Self;

/**
 * `.wrap(wrapper)`: the test-local frame every render of this chain is
 * dressed in. A later call replaces an earlier one — the wrappers do not
 * nest. It arms nothing: the render reads it when it mounts.
 */
export const wrap = defineCapability<'wrap', null | Wrapper, [wrapper: Wrapper]>({
    initial: null,
    name: 'wrap',
    phase: 30,
    reduce: (_stated, [wrapper]) => wrapper,
    row: { group: 'Setup', name: '.wrap()', probe: '.wrap(' },
});
