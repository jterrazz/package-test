import type { TestProjectInlineConfiguration } from 'vitest/config';

import { facetProject } from '../../vitest/project.js';
import type { FacetProjectOptions } from '../../vitest/project.js';

/** `lint()` — the rules a project ships, run by the real linters over fixture trees. */
export type LintProjectOptions = FacetProjectOptions;

export function lint(options: LintProjectOptions = {}): TestProjectInlineConfiguration {
    return facetProject('lint', options);
}
