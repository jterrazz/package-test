/**
 * The jobs chain — the shared builder's, named here.
 *
 * A re-export rather than an implementation: the setups and the terminal
 * actions of the node facets are ONE builder ({@link SpecificationBuilder}),
 * because a second copy of "declare a contract, seed a table, run the thing"
 * is how two facets drift.
 * The constructor beside it imports its chain from HERE, so the name a facet
 * answers to is stated in the facet's own folder.
 */
export { createJobsFacet } from '../../model/chain/builder.js';
export type { JobsSpecification } from '../../model/chain/builder.js';
