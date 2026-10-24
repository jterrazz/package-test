import type { TestProjectInlineConfiguration } from 'vitest/config';

import { specificationProject } from '../../vitest/project.js';
import type { SpecificationProjectOptions } from '../../vitest/project.js';

/** `deployment()`: a running deployment, met over the network through complete HTTP exchanges. */
export type DeploymentProjectOptions = SpecificationProjectOptions;

export function deployment(options: DeploymentProjectOptions = {}): TestProjectInlineConfiguration {
    return specificationProject('deployment', options);
}
