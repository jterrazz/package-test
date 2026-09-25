import { componentFacet } from './component.facet.js';
import type { ComponentChain } from './component.facet.js';

/**
 * The component chain — the composition's, opened once for the page.
 *
 * The chain carries no configuration: what every render shares is the
 * project's (`component()` in `vitest.config.ts`), read by the engines
 * where the page provides it.
 */
export const component: ComponentChain = componentFacet.open({});
