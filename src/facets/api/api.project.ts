import { mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { facetProject, routeCoverageSetup } from '../../runner/facet-project.js';
import type { FacetProjectOptions } from '../../runner/facet-project.js';

/** `api()` — the app met through HTTP. */
export type ApiProjectOptions = FacetProjectOptions;

/**
 * An api project collects the facet's `.spec.ts` files —
 * `specs/api/**\/*.spec.ts` — and measures its route coverage: a global setup
 * names, after the run, every route the apps declare that no test reached.
 */
export function api(options: ApiProjectOptions = {}): TestProjectInlineConfiguration {
    return mergeConfig(facetProject('api', options), {
        test: { globalSetup: [routeCoverageSetup()] },
    }) as TestProjectInlineConfiguration;
}
