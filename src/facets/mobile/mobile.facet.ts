import type { MatrixRow } from '../../kernel/chain/capability.js';
import type { ChainOf } from '../../kernel/chain/chain.js';
import type { Started } from '../../kernel/chain/config.js';
import { defineFacet } from '../../kernel/chain/define-facet.js';
import { getCallerDir } from '../../kernel/files/caller.js';
import { stubBackend } from '../../world/stubs/delivery/other-process/stub-backend.adapter.js';
import { intercept } from '../../world/stubs/intercept/intercept.capability.js';
import type { MobileConfig, MobileSpecificationOptions } from './mobile.handle.js';
import { appiumApp } from './screen/appium-app.adapter.js';
/* oxlint-disable typescript/consistent-type-definitions, typescript/no-empty-object-type -- the chain is an empty interface over its computed type: the compiler prints an interface by its name, where an alias of a computed type may print expanded */
import { open } from './screen/open.action.js';

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

/** The chain `specification.mobile()` hands out: the app runs on a device, its network the declared stub backend. */
export interface MobileSpecification extends ChainOf<
    typeof composition,
    { databaseKey: string; services: Record<string, unknown> },
    MobileSpecification
> {}

export const mobileFacet = defineFacet<
    MobileSpecification,
    Started<MobileConfig, 'bundleId' | 'device'>
>()({
    ...composition,
    adapters: (config: Started<MobileConfig, 'bundleId' | 'device'>) => ({
        app: appiumApp(config),
        network: stubBackend(config.backend, 'mobile'),
    }),
    locate: getCallerDir,
});
