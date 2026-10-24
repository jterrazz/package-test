import type { TestProjectInlineConfiguration } from 'vitest/config';

import { specificationProject } from '../../vitest/project.js';
import type { SpecificationProjectOptions } from '../../vitest/project.js';

/** `lint()`: the rules a project ships, run by the real linters over fixture trees. */
export type LintProjectOptions = SpecificationProjectOptions & {
    /** `false` shares one module graph per worker (`isolate: false`); for specs that keep no state in a module. */
    isolate?: boolean;
};

export function lint(options: LintProjectOptions = {}): TestProjectInlineConfiguration {
    const project = specificationProject('lint', options);

    return options.isolate === undefined
        ? project
        : { ...project, test: { ...project.test, isolate: options.isolate } };
}
