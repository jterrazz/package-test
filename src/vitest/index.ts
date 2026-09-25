/**
 * `@jterrazz/test/vitest` — the runner-config surface.
 *
 * Everything here is imported by `vitest.config.ts`, never by a spec: it wires
 * the runner, it does not assert. The framework's own single import point for
 * SPECS stays `@jterrazz/test` (CONVENTIONS F1).
 */

export { literate, type LiterateOptions, type LiteratePlugin } from '../facets/cli/cli.project.js';
export { defineSpecConfig, type SpecConfig } from './preset.js';
export {
    api,
    type ApiProjectOptions,
    cli,
    type CliProjectOptions,
    component,
    type ComponentProjectOptions,
    type FacetProjectOptions,
    integration,
    type IntegrationProjectOptions,
    job,
    type JobProjectOptions,
    type LiterateDoor,
    mobile,
    type MobileProjectOptions,
    unit,
    type UnitProjectOptions,
    website,
    type WebsiteProjectOptions,
} from './projects.js';
