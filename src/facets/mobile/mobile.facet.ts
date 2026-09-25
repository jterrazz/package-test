/* oxlint-disable typescript/consistent-type-definitions, typescript/no-empty-object-type -- the chain is an empty interface over its computed type: the compiler prints an interface by its name, where an alias of a computed type may print expanded */
import { open } from '../../actions/open/open.action.js';
import { intercept } from '../../capabilities/intercept/intercept.capability.js';
import { getCallerDir } from '../../model/chain/caller.js';
import type { MatrixRow } from '../../model/chain/capability.js';
import type { SpecificationConfig } from '../../model/chain/config.js';
import { appiumApp } from '../../seams/appium/appium.app.js';
import { stubBackend } from '../../seams/stub-backend/stub-backend.engine.js';
import type { ChainOf } from '../chain.js';
import { defineFacet } from '../define-facet.js';
import type { MobileSpecificationOptions } from './mobile.handle.js';

const composition = {
    actions: [open],
    capabilities: [intercept],
    options: {
        app: { group: 'Constructor option', name: 'app', probe: 'app:' },
        appium: { group: 'Constructor option', name: 'appium', probe: 'appium:' },
        backend: { group: 'Constructor option', name: 'backend', probe: 'backend:' },
        device: { group: 'Constructor option', name: 'device', probe: 'device:' },
        root: { group: 'Constructor option', name: 'root', probe: 'root:' },
        services: { group: 'Constructor option', name: 'services', probe: 'services:' },
        timeouts: { group: 'Constructor option', name: 'timeouts', probe: 'timeouts:' },
    } satisfies Record<keyof MobileSpecificationOptions, MatrixRow>,
} as const;

/**
 * The `mobile` facet — the chain `specification.mobile()` hands out. The app
 * runs on a device, in its own process: its clock is not this chain's to pin,
 * and its network is the declared stub backend. `.open()` is the one terminal
 * action: it relaunches the app (a deterministic fresh state), applies the
 * deep link, runs the scenario, and captures the final screen.
 */
export interface MobileSpecification extends ChainOf<
    typeof composition,
    { databaseKey: string; services: Record<string, unknown> },
    MobileSpecification
> {}

export const mobileFacet = defineFacet<MobileSpecification>()({
    ...composition,
    engines: (config: SpecificationConfig) => ({
        app: appiumApp(config),
        network: stubBackend(config.backend, 'mobile'),
    }),
    locate: getCallerDir,
});
