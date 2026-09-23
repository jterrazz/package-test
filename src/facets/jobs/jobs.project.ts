import type { TestProjectInlineConfiguration } from 'vitest/config';

import { facetProject } from '../../runner/facet-project.js';
import type { FacetProjectOptions } from '../../runner/facet-project.js';

/** `jobs()` — the background jobs, run in this process. */
export type JobsProjectOptions = FacetProjectOptions;

/** A jobs project collects the facet's `.spec.ts` files: `specs/jobs/**\/*.spec.ts`. */
export function jobs(options: JobsProjectOptions = {}): TestProjectInlineConfiguration {
    return facetProject('jobs', options);
}
