import type { ComponentChain } from './component.facet.js';
import { componentFacet } from './component.facet.js';
import { registerBrowserMatchers } from './golden/golden.js';

/** The component chain, opened once for the page; shared configuration is the project's. */
export const component: ComponentChain = componentFacet.open({});

// Armed by the import that brought `component` in: no setup file, no hook.
registerBrowserMatchers();
