// oxlint-disable-next-line import/no-empty-named-blocks, unicorn/require-module-specifiers -- the `test` section the entry types is an augmentation of `@jterrazz/typescript/config`, which a program sees only when it imports the module declaring it
import type {} from './engine/project/settings.js';

export { testPreset as test } from './consumer/rulebook/preset.js';
export type { TestSettings } from './engine/project/settings.js';
