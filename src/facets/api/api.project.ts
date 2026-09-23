import type { TestProjectInlineConfiguration } from 'vitest/config';

import { facetProject } from '../../runner/facet-project.js';
import type { FacetProjectOptions } from '../../runner/facet-project.js';

/** `api()` — the app met through HTTP. */
export type ApiProjectOptions = FacetProjectOptions;

/** An api project collects the facet's `.spec.ts` files: `specs/api/**\/*.spec.ts`. */
export function api(options: ApiProjectOptions = {}): TestProjectInlineConfiguration {
    return facetProject('api', options);
}
