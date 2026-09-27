/** What test material is, for a build guard: `materialAt(path)` and `testPackageOf(specifier)`. */
export { materialAt, testPackageOf } from './engine/project/production.js';
export type { MaterialKind } from './engine/project/production.js';

export { recommendedRules } from './consumer/catalogue/manifest.js';
export { default } from './consumer/rules/plugin.js';
