// The component facet's face in a page: its chain, opened once, and
// The matchers a page serves goldens through.
import type { ComponentChain } from './component.facet.js';
import { componentFacet } from './component.facet.js';

/**
 * The component chain, opened once for the page. It carries no
 * configuration: what every render shares is the project's (`component()` in
 * `vitest.config.ts`), read by the engines where the page provides it.
 */
export const component: ComponentChain = componentFacet.open({});
export { registerBrowserMatchers } from './golden/golden.js';
