import { mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { servicesSetup } from '../../services/containers/run-setup.js';
import { inProcessProject } from '../../vitest/project.js';
import type { InProcessProjectOptions } from '../../vitest/project.js';

/** `job()` — the background jobs, run in this process. */
export type JobProjectOptions = InProcessProjectOptions;

export function job(options: JobProjectOptions = {}): TestProjectInlineConfiguration {
    return mergeConfig(inProcessProject('job', options), {
        test: { globalSetup: [servicesSetup()] },
    }) as TestProjectInlineConfiguration;
}
