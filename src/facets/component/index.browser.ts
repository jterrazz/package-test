// The component facet's face in a page: its chain, opened once, with the
// matchers a page serves goldens through armed beside it.
import type { ComponentChain } from './component.facet.js';
import { componentFacet } from './component.facet.js';
import { registerBrowserMatchers } from './golden/golden.js';

/**
 * The component chain, opened once for the page. It carries no
 * configuration: what every render shares is the project's (`component()` in
 * `vitest.config.ts`), read by the engines where the page provides it.
 */
export const component: ComponentChain = componentFacet.open({});

// The page's own matchers, armed by the import that brought `component` in: a
// component test writes no setup file and no hook for them.
registerBrowserMatchers();
