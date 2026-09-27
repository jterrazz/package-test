import { mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { facetProject } from '../../vitest/project.js';
import type { FacetProjectOptions } from '../../vitest/project.js';
import { servicesSetup } from '../../world/services/containers/run-setup.js';
import { routeCoverageSetup } from './routes/route-coverage.js';

/** `api()` — the app met through HTTP. */
export type ApiProjectOptions = FacetProjectOptions;

export function api(options: ApiProjectOptions = {}): TestProjectInlineConfiguration {
    return mergeConfig(facetProject('api', options), {
        test: { globalSetup: [servicesSetup(), routeCoverageSetup()] },
    }) as TestProjectInlineConfiguration;
}
