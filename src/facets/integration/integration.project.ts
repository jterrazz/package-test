import { mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { facetProject } from '../../vitest/project.js';
import type { FacetProjectOptions } from '../../vitest/project.js';
import { servicesSetup } from '../../world/services/containers/run-setup.js';

/** `integration()` — a module against real services, or against a golden. */
export type IntegrationProjectOptions = FacetProjectOptions;

/** An integration project collects the facet's `.spec.ts` files. */
export function integration(
    options: IntegrationProjectOptions = {},
): TestProjectInlineConfiguration {
    return mergeConfig(facetProject('integration', options), {
        test: { globalSetup: [servicesSetup()] },
    }) as TestProjectInlineConfiguration;
}
