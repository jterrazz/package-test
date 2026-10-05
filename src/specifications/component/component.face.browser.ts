import type { ComponentChain } from './component.composition.js';
import { componentDefinition } from './component.composition.js';
import { registerBrowserMatchers } from './golden/golden.js';

/** The component chain, opened once for the page; shared configuration is the project's. */
export const component: ComponentChain = componentDefinition.open({});

// invariant: armed by the import that brought `component` in: no setup file, no hook.
registerBrowserMatchers();
