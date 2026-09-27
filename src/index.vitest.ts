import { mergeConfig } from 'vitest/config';
import type { ViteUserConfig } from 'vitest/config';

import { literate } from './facets/cli/cli.project.js';
import type { LiterateOptions } from './facets/cli/cli.project.js';
import { presetConfig } from './vitest/preset.js';

export { api, type ApiProjectOptions } from './facets/api/api.project.js';
export {
    cli,
    type CliProjectOptions,
    literate,
    type LiterateDoor,
    type LiterateOptions,
    type LiteratePlugin,
} from './facets/cli/cli.project.js';
export { component, type ComponentProjectOptions } from './facets/component/component.project.js';
export {
    integration,
    type IntegrationProjectOptions,
} from './facets/integration/integration.project.js';
export { job, type JobProjectOptions } from './facets/job/job.project.js';
export { lint, type LintProjectOptions } from './facets/lint/lint.project.js';
export { mobile, type MobileProjectOptions } from './facets/mobile/mobile.project.js';
export { website, type WebsiteProjectOptions } from './facets/website/website.project.js';
export { type FacetProjectOptions } from './vitest/project.js';
export { unit, type UnitProjectOptions } from './vitest/unit.project.js';

/** A vite/vitest config, merged over the preset's defaults, plus `literate`. */
export type SpecConfig = ViteUserConfig & {
    /** Turns matching `<case>.spec.yaml` files into tests; with `projects`, put the plugin in the collecting project instead. */
    literate?: LiterateOptions;
};

/** The shared vitest config: what you pass is merged over the defaults. */
export function defineSpecConfig(config: SpecConfig = {}): ViteUserConfig {
    const { literate: literateOptions, ...userConfig } = config;
    return presetConfig(
        literateOptions
            ? (mergeConfig({ plugins: [literate(literateOptions)] }, userConfig) as ViteUserConfig)
            : userConfig,
    );
}
