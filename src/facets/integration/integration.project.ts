import { mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { servicesSetup } from '../../services/containers/run-setup.js';
import { facetProject } from '../../vitest/project.js';
import type { FacetProjectOptions } from '../../vitest/project.js';

/** `integration()` — a module against real services, or against a golden. */
export type IntegrationProjectOptions = FacetProjectOptions;

export function integration(
    options: IntegrationProjectOptions = {},
): TestProjectInlineConfiguration {
    return mergeConfig(facetProject('integration', options), {
        test: { globalSetup: [servicesSetup()] },
    }) as TestProjectInlineConfiguration;
}
