/**
 * The component chain's name, where BOTH runtimes can read it.
 *
 * The page gets the working chain; node gets a stub under the same name and
 * the same type, so a component test that ran in the wrong project fails on
 * the line that rendered rather than on a missing export. The published types
 * are the node build's, and the type is the composition's (`component.facet.ts`).
 */
export type { ComponentChain } from './component.facet.js';
