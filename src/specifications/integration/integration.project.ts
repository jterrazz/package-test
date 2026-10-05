import { mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { servicesSetup } from '../../services/containers/services.global-setup.js';
import { inProcessProject } from '../../vitest/project.js';
import type { InProcessProjectOptions } from '../../vitest/project.js';

/** `integration()` — a module against real services, or against a golden. */
export type IntegrationProjectOptions = InProcessProjectOptions;

export function integration(
    options: IntegrationProjectOptions = {},
): TestProjectInlineConfiguration {
    return mergeConfig(inProcessProject('integration', options), {
        test: { globalSetup: [servicesSetup()] },
    }) as TestProjectInlineConfiguration;
}
