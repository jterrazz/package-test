import { component } from '../../../../vitest/projects.js';

/** Names its pipeline and wrap relative to this file; loaded from the package root, as knip and the type-checker read configs. */
export default await component({ vite: './vite.config.ts', wrap: './providers.ts' });
