/**
 * The jobs chain — the shared builder's, named here.
 *
 * Every facet folder carries the SAME four files (jobs.specification.ts,
 * jobs.chain.ts, jobs.result.ts, jobs.project.ts) so a reader who has seen one
 * facet has seen the shape of all seven. This one is a re-export rather than
 * an implementation: the setups and the terminal actions of the node facets
 * are ONE builder ({@link SpecificationBuilder}), because a second copy of
 * "declare a contract, seed a table, run the thing" is how two facets drift.
 * The constructor beside it imports its chain from HERE, so the name a facet
 * answers to is stated in the facet's own folder.
 */
export { createJobsFacet } from '../../core/chain/builder.js';
export type { JobsSpecification } from '../../core/chain/builder.js';
