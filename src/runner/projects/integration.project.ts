import { mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { facetProject, servicesSetup } from '../facet-project.js';
import type { FacetProjectOptions } from '../facet-project.js';

/** `integration()` — a module against real services, or against a golden. */
export function integration(options: FacetProjectOptions = {}): TestProjectInlineConfiguration {
    return mergeConfig(facetProject('integration', options), {
        test: { globalSetup: [servicesSetup()] },
    }) as TestProjectInlineConfiguration;
}
