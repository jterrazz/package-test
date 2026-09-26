import { mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { facetProject } from '../../vitest/project.js';
import type { FacetProjectOptions } from '../../vitest/project.js';
import { servicesSetup } from '../../world/services/containers/run-setup.js';

/** `job()` — the background jobs, run in this process. */
export type JobProjectOptions = FacetProjectOptions;

/** A job project collects the facet's `.spec.ts` files. */
export function job(options: JobProjectOptions = {}): TestProjectInlineConfiguration {
    return mergeConfig(facetProject('job', options), {
        test: { globalSetup: [servicesSetup()] },
    }) as TestProjectInlineConfiguration;
}
