/** What test material is, for a build guard: `materialAt(path)` and `testPackageOf(specifier)`. */
export { materialAt, testPackageOf } from './kit/project/material.js';
export type { MaterialKind } from './kit/project/material.js';

export { recommendedRules } from './consumer/catalogue/manifest.js';
export { default } from './consumer/rules/plugin.js';
