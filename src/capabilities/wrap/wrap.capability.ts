import type { ComponentUi } from '../../seams/vitest-browser/ui.js';

/** `.wrap(wrapper)`, handing back the chain it was called on. */
export type WrapMethod<Self> = (wrapper: (ui: ComponentUi) => ComponentUi) => Self;
