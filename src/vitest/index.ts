/**
 * `@jterrazz/test/vitest` — the runner-config surface.
 *
 * Everything here is imported by `vitest.config.ts`, never by a spec: it wires
 * the runner, it does not assert. The framework's own single import point for
 * SPECS stays `@jterrazz/test` (CONVENTIONS F1).
 */

export { literate, type LiterateOptions, type LiteratePlugin } from './literate-plugin.js';
export { defineSpecConfig, type SpecConfig } from './preset.js';
