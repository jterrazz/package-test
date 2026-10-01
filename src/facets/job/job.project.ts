import { mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { servicesSetup } from '../../services/containers/run-setup.js';
import { facetProject } from '../../vitest/project.js';
import type { FacetProjectOptions } from '../../vitest/project.js';

/** `job()` — the background jobs, run in this process. */
export type JobProjectOptions = FacetProjectOptions;

export function job(options: JobProjectOptions = {}): TestProjectInlineConfiguration {
    return mergeConfig(facetProject('job', options), {
        test: { globalSetup: [servicesSetup()] },
    }) as TestProjectInlineConfiguration;
}
