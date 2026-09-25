import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { facetProject, servicesSetup } from '../../vitest/facet-project.js';
import type { FacetProjectOptions } from '../../vitest/facet-project.js';

/**
 * The global setup that measures route coverage — this facet's
 * `routes/route-coverage.ts` in a source checkout, `route-coverage.js` in the
 * built package, where the bundle and its entries share one folder.
 */
export function routeCoverageSetup(): string {
    const source = join(import.meta.dirname, 'routes/route-coverage.ts');
    return existsSync(source) ? source : join(import.meta.dirname, 'route-coverage.js');
}

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
