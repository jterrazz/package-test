import { mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { facetProject, routeCoverageSetup, servicesSetup } from '../facet-project.js';
import type { FacetProjectOptions } from '../facet-project.js';

/** `api()` — the app met through HTTP. */
export type ApiProjectOptions = FacetProjectOptions;

/**
 * An api project collects the facet's `.spec.ts` files —
 * `specs/api/**\/*.spec.ts` — serves the project's service containers, and measures
 * its route coverage: a global setup names, after the run, every route the
 * apps declare that no test reached.
 */
export function api(options: ApiProjectOptions = {}): TestProjectInlineConfiguration {
    return mergeConfig(facetProject('api', options), {
        test: { globalSetup: [servicesSetup(), routeCoverageSetup()] },
    }) as TestProjectInlineConfiguration;
}
