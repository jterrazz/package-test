import { mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { facetProject } from '../../vitest/project.js';
import type { FacetProjectOptions } from '../../vitest/project.js';

/** `website()` — the assembled product, met through a served page. */
export type WebsiteProjectOptions = FacetProjectOptions;

export function website(options: WebsiteProjectOptions = {}): TestProjectInlineConfiguration {
    return mergeConfig(facetProject('website', options), {
        test: { sequence: { groupOrder: 1 } },
    }) as TestProjectInlineConfiguration;
}
