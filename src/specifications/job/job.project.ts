import { mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { servicesSetup } from '../../services/containers/services.global-setup.js';
import { runnerProject } from '../../vitest/project.js';
import type { InProcessProjectOptions } from '../../vitest/project.js';

/** `job()`: the background jobs, run in this process. */
export type JobProjectOptions = InProcessProjectOptions;

export function job(options: JobProjectOptions = {}): TestProjectInlineConfiguration {
    return mergeConfig(runnerProject('job', options), {
        test: { globalSetup: [servicesSetup()] },
    }) as TestProjectInlineConfiguration;
}
