import { mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration } from 'vitest/config';

import { specificationProject } from '../../vitest/project.js';
import type { SpecificationProjectOptions } from '../../vitest/project.js';
import type { MobileDevice } from './device/device.port.js';
import { mobileSessionSetup } from './session/mobile-session.global-setup.js';

/** The common options; for a run whose specs spawn no server, the device its one Appium server drives. */
export type MobileProjectOptions = SpecificationProjectOptions &
    ({ device: MobileDevice; root?: string } | { device?: never; root?: never });

/** A simulator cannot share a machine with itself: serial, unless `serial: false` states a server that gives every session an app of its own. A global setup holds the run's driver sessions, one per worker. */
export function mobile(options: MobileProjectOptions = {}): TestProjectInlineConfiguration {
    const { device, root, ...common } = options;
    return mergeConfig(
        specificationProject('mobile', { ...common, serial: common.serial !== false }),
        {
            test: {
                globalSetup: [mobileSessionSetup()],
                ...(device === undefined
                    ? {}
                    : { provide: { mobileAppium: { device, root: root ?? '.' } } }),
            },
        },
    ) as TestProjectInlineConfiguration;
}
