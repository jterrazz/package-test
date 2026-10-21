import type { TestProjectInlineConfiguration } from 'vitest/config';

import { runnerProject } from '../../vitest/project.js';
import type { RunnerOption, SpecificationProjectOptions } from '../../vitest/project.js';

/** `website()`: the assembled product, met through a served page. */
export type WebsiteProjectOptions = RunnerOption & SpecificationProjectOptions;

export function website(options: WebsiteProjectOptions = {}): TestProjectInlineConfiguration {
    return runnerProject('website', options);
}
