import { mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { facetProject, servicesSetup } from '../../vitest/facet-project.js';
import type { FacetProjectOptions } from '../../vitest/facet-project.js';

/** `job()` — the background jobs, run in this process. */
export type JobProjectOptions = FacetProjectOptions;

/** A job project collects the facet's `.spec.ts` files: `specs/job/**\/*.spec.ts`. */
export function job(options: JobProjectOptions = {}): TestProjectInlineConfiguration {
    return mergeConfig(facetProject('job', options), {
        test: { globalSetup: [servicesSetup()] },
    }) as TestProjectInlineConfiguration;
}
