import { mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { servicesSetup } from '../../services/containers/run-setup.js';
import { inProcessProject } from '../../vitest/project.js';
import type { InProcessProjectOptions } from '../../vitest/project.js';
import { routeCoverageSetup } from './routes/route-coverage.js';

/** `api()` — the app met through HTTP. */
export type ApiProjectOptions = InProcessProjectOptions;

export function api(options: ApiProjectOptions = {}): TestProjectInlineConfiguration {
    return mergeConfig(inProcessProject('api', options), {
        test: { globalSetup: [servicesSetup(), routeCoverageSetup()] },
    }) as TestProjectInlineConfiguration;
}
