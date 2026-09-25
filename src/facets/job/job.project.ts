import { mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { facetProject } from '../../vitest/project-kit.js';
import type { FacetProjectOptions } from '../../vitest/project-kit.js';
import { servicesSetup } from '../../world/services/containers/run-setup.js';

/** `job()` — the background jobs, run in this process. */
export type JobProjectOptions = FacetProjectOptions;

/** A job project collects the facet's `.spec.ts` files: `specs/job/**\/*.spec.ts`. */
export function job(options: JobProjectOptions = {}): TestProjectInlineConfiguration {
    return mergeConfig(facetProject('job', options), {
        test: { globalSetup: [servicesSetup()] },
    }) as TestProjectInlineConfiguration;
}
