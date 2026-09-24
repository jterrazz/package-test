import { mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { facetProject, mobileSessionSetup } from '../../runner/facet-project.js';
import type { FacetProjectOptions } from '../../runner/facet-project.js';

/**
 * `mobile()` — the app on a simulator. A simulator is the one thing that
 * cannot share a machine with itself, so it runs last and alone (group 3)
 * AND serial: the files take turns on the one simulator, so
 * `fileParallelism: false` is this project's own default — `serial` needs
 * no passing. A global setup holds one driver session for the whole run:
 * the first file opens it, every later file drives it, and the setup ends it
 * after the last.
 */
export function mobile(options: FacetProjectOptions = {}): TestProjectInlineConfiguration {
    return mergeConfig(facetProject('mobile', options), {
        test: {
            fileParallelism: false,
            globalSetup: [mobileSessionSetup()],
            sequence: { groupOrder: 3 },
        },
    }) as TestProjectInlineConfiguration;
}
