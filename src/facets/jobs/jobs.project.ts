import type { TestProjectInlineConfiguration } from 'vitest/config';

import { facetProject } from '../../runner/facet-project.js';
import type { FacetProjectOptions } from '../../runner/facet-project.js';

/** `jobs()` — what a name triggers in-process. */
export function jobs(options: FacetProjectOptions = {}): TestProjectInlineConfiguration {
    return facetProject('jobs', options);
}
