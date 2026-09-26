import type { OxlintConfig } from '@jterrazz/typescript/oxlint';

import { specificationEndsOnItsCleanup } from './consumer/rulebook/import.js';
import { vitestOnTests } from './consumer/rulebook/vitest.js';
import { recommendedRules } from './consumer/rules/plugin.js';

/** What test material is, for a build guard: `materialAt(path)` and `testPackageOf(specifier)`. */
export { materialAt, testPackageOf } from './engine/project/production.js';
export type { MaterialKind } from './engine/project/production.js';

export { default, recommendedRules } from './consumer/rules/plugin.js';

/* Typed as oxlint's own config, so `compose(<profile>, testing)` type-checks: an inferred `rules` widens every severity to `string`. */
export const testing: OxlintConfig = {
    jsPlugins: ['@jterrazz/test/oxlint'],
    overrides: [specificationEndsOnItsCleanup, vitestOnTests],
    rules: recommendedRules,
};
