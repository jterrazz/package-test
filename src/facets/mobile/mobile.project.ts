import { mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { facetProject, mobileSessionSetup } from '../../runner/facet-project.js';
import type { FacetProjectOptions } from '../../runner/facet-project.js';
import type { MobileDevice } from './appium-server.js';

/**
 * What `mobile()` accepts: the common options, and — for a run whose specs
 * spawn no server of their own — the device its one Appium server drives and
 * the root its binary is resolved from, relative to the config's root.
 */
export type MobileProjectOptions = FacetProjectOptions &
    ({ device: MobileDevice; root?: string } | { device?: never; root?: never });

/**
 * `mobile()` — the app on a simulator. A simulator is the one thing that
 * cannot share a machine with itself, so it runs last and alone (group 3)
 * AND serial: the files take turns on the one simulator, so
 * `fileParallelism: false` is this project's own default — `serial` needs
 * no passing. A global setup holds one driver session for the whole run:
 * the first file opens it, every later file drives it, and the setup ends it
 * after the last. With a `device`, that setup also boots the simulator and
 * spawns the project's Appium server once for the run, and stops it after.
 */
export function mobile(options: MobileProjectOptions = {}): TestProjectInlineConfiguration {
    const { device, root, ...common } = options;
    return mergeConfig(facetProject('mobile', common), {
        test: {
            fileParallelism: false,
            globalSetup: [mobileSessionSetup()],
            ...(device === undefined
                ? {}
                : { provide: { mobileAppium: { device, root: root ?? '.' } } }),
            sequence: { groupOrder: 3 },
        },
    }) as TestProjectInlineConfiguration;
}
