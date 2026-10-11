/* oxlint-disable typescript/no-empty-object-type -- the chain is an empty interface over its computed type: the compiler prints an interface by its name, where an alias of a computed type may print expanded */
import type { MatrixRow } from '../../chain/capability.js';
import type { ChainOf } from '../../chain/chain.js';
import type { Started } from '../../chain/config.js';
import { headers } from '../../chain/context/headers.capability.js';
import { sharing } from '../../chain/context/with.capability.js';
import { defineSpecification } from '../../chain/define-specification.js';
import { getCallerDir } from '../../chain/paths/caller.js';
import { clock } from '../../clock/clock.capability.js';
import { stubBackend } from '../../stubs/delivery/other-process/stub-backend.adapter.js';
import { intercept } from '../../stubs/intercept/intercept.capability.js';
import { pageClock } from './browser/page-clock.adapter.js';
import { storage } from './browser/storage.capability.js';
import { rawFetch } from './fetch/fetch.action.js';
import { visit } from './visit/visit.action.js';
import type { WebsiteConfig, WebsiteSpecificationOptions } from './website.handle.js';

const composition = {
    actions: [visit, rawFetch],
    capabilities: [clock, headers, intercept, sharing, storage],
    options: {
        backend: { group: 'Constructor option', name: 'backend', probe: 'backend:' },
        external: { group: 'Constructor option', name: 'external', probe: 'external:' },
        root: { group: 'Constructor option', name: 'root', probe: 'root:' },
        server: { group: 'Constructor option', name: 'server', probe: 'server:' },
        services: { group: 'Constructor option', name: 'services', probe: 'services:' },
        transform: { group: 'Constructor option', name: 'transform', probe: 'transform:' },
        url: { group: 'Constructor option', name: 'url', probe: 'url:' },
    } satisfies Record<keyof WebsiteSpecificationOptions, MatrixRow>,
} as const;

/** The chain `specification.website()` hands out; the site runs in its own process, its stubs served by the stub backend. */
export interface WebsiteSpecification extends ChainOf<
    typeof composition,
    { databaseKey: string; services: Record<string, unknown> },
    WebsiteSpecification
> {}

export const websiteDefinition = defineSpecification<
    WebsiteSpecification,
    Started<WebsiteConfig, 'browser'>
>()({
    ...composition,
    adapters: (config: Started<WebsiteConfig, 'browser'>) => ({
        browser: config.browser,
        clock: pageClock,
        network: stubBackend(config.backend, 'website'),
    }),
    locate: getCallerDir,
});
