import { mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { facetProject } from '../../vitest/project-kit.js';
import type { FacetProjectOptions } from '../../vitest/project-kit.js';
import { servicesSetup } from '../../world/services/containers/run-setup.js';

/** `integration()` — a module against real services, or against a golden. */
export type IntegrationProjectOptions = FacetProjectOptions;

/** An integration project collects the facet's `.spec.ts` files: `specs/integration/**\/*.spec.ts`. */
export function integration(
    options: IntegrationProjectOptions = {},
): TestProjectInlineConfiguration {
    return mergeConfig(facetProject('integration', options), {
        test: { globalSetup: [servicesSetup()] },
    }) as TestProjectInlineConfiguration;
}
