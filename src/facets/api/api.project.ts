import type { TestProjectInlineConfiguration } from 'vitest/config';

import { facetProject } from '../../runner/facet-project.js';
import type { FacetProjectOptions } from '../../runner/facet-project.js';

/** `api()` — the app met through HTTP. */
export function api(options: FacetProjectOptions = {}): TestProjectInlineConfiguration {
    return facetProject('api', options);
}
