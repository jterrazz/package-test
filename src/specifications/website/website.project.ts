import { mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { specificationProject } from '../../vitest/project.js';
import type { SpecificationProjectOptions } from '../../vitest/project.js';

/** `website()` — the assembled product, met through a served page. */
export type WebsiteProjectOptions = SpecificationProjectOptions;

export function website(options: WebsiteProjectOptions = {}): TestProjectInlineConfiguration {
    return mergeConfig(specificationProject('website', options), {
        test: { sequence: { groupOrder: 1 } },
    }) as TestProjectInlineConfiguration;
}
