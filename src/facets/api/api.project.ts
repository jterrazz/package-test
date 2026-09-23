import type { TestProjectInlineConfiguration } from 'vitest/config';

import { documentProject } from '../../runner/facet-project.js';
import type { FacetProjectOptions, LiterateDoor } from '../../runner/facet-project.js';

/** `api()` — the app met through HTTP, and the documents that specify it. */
export type ApiProjectOptions = FacetProjectOptions & LiterateDoor;

/**
 * A api project collects the facet's `.spec.ts` files AND its documents:
 * `specs/api/**\/*.spec.yaml`, bound to `specs/api/api.specification.ts`
 * unless `literate` says otherwise.
 */
export function api(options: ApiProjectOptions = {}): TestProjectInlineConfiguration {
    return documentProject('api', options);
}
