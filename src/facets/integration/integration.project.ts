import type { TestProjectInlineConfiguration } from 'vitest/config';

import { facetProject } from '../../runner/facet-project.js';
import type { FacetProjectOptions } from '../../runner/facet-project.js';

/** `integration()` — a module against real services, or against a golden. */
export function integration(options: FacetProjectOptions = {}): TestProjectInlineConfiguration {
    return facetProject('integration', options);
}
