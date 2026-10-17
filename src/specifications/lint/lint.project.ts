import type { TestProjectInlineConfiguration } from 'vitest/config';

import { specificationProject } from '../../vitest/project.js';
import type { SpecificationProjectOptions } from '../../vitest/project.js';

/** `lint()`: the rules a project ships, run by the real linters over fixture trees. */
export type LintProjectOptions = SpecificationProjectOptions;

export function lint(options: LintProjectOptions = {}): TestProjectInlineConfiguration {
    return specificationProject('lint', options);
}
