import type { TestProjectInlineConfiguration } from 'vitest/config';

import { documentProject } from '../../runner/facet-project.js';
import type { FacetProjectOptions, LiterateDoor } from '../../runner/facet-project.js';

/** `jobs()` — what a name triggers in-process, and the documents that specify it. */
export type JobsProjectOptions = FacetProjectOptions & LiterateDoor;

/**
 * A jobs project collects the facet's `.spec.ts` files AND its documents:
 * `specs/jobs/**\/*.spec.yaml`, bound to `specs/jobs/jobs.specification.ts`
 * unless `literate` says otherwise.
 */
export function jobs(options: JobsProjectOptions = {}): TestProjectInlineConfiguration {
    return documentProject('jobs', options);
}
