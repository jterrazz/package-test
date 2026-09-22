import { component } from '../../projects.js';

/**
 * The `vitest.config.ts` of an app that does not live at the repository root,
 * naming its pipeline and its wrap the way a consumer writes them: relative to
 * THIS file. Loaded from the package root by the spec beside `projects.ts`,
 * which is how knip and the type-checker read a repository's configs.
 */
export default await component({ vite: './vite.config.ts', wrap: './providers.ts' });
