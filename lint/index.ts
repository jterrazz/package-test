import type { OxlintConfig } from '@jterrazz/typescript/oxlint';

import { TESTING_PRESET_OXLINT } from './consumer/rulebook/preset.js';

/** What test material is, for a build guard: `materialAt(path)` and `testPackageOf(specifier)`. */
export { materialAt, testPackageOf } from './engine/project/production.js';
export type { MaterialKind } from './engine/project/production.js';

export { default, recommendedRules } from './consumer/rules/plugin.js';

/** The oxlint half of the `test()` preset, for a config that composes by hand: `compose(<profile>, testing)`. */
export const testing: OxlintConfig = TESTING_PRESET_OXLINT;
