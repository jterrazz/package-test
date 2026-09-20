import { mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { facetProject } from '../../runner/facet-project.js';
import type { FacetProjectOptions } from '../../runner/facet-project.js';

/**
 * `mobile()` — the app on a simulator. A simulator is the one thing that
 * cannot share a machine with itself, so it runs last and alone (group 3).
 */
export function mobile(options: FacetProjectOptions = {}): TestProjectInlineConfiguration {
    return mergeConfig(facetProject('mobile', options), {
        test: { sequence: { groupOrder: 3 } },
    }) as TestProjectInlineConfiguration;
}
