import { mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { facetProject, servicesSetup } from '../facet-project.js';
import type { FacetProjectOptions } from '../facet-project.js';

/** `jobs()` — the background jobs, run in this process. */
export type JobsProjectOptions = FacetProjectOptions;

/** A jobs project collects the facet's `.spec.ts` files: `specs/jobs/**\/*.spec.ts`. */
export function jobs(options: JobsProjectOptions = {}): TestProjectInlineConfiguration {
    return mergeConfig(facetProject('jobs', options), {
        test: { globalSetup: [servicesSetup()] },
    }) as TestProjectInlineConfiguration;
}
