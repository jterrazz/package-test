import { mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { facetProject } from '../../vitest/project-kit.js';
import type { FacetProjectOptions } from '../../vitest/project-kit.js';
import type { MobileDevice } from './device/device.port.js';
import { mobileSessionSetup } from './session/mobile-session.js';

/** The common options; for a run whose specs spawn no server, the device its one Appium server drives. */
export type MobileProjectOptions = FacetProjectOptions &
    ({ device: MobileDevice; root?: string } | { device?: never; root?: never });

/** A simulator cannot share a machine with itself: last (group 3) and serial. A global setup holds one driver session for the run. */
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
