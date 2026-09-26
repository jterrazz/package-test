import type { MatrixRow } from '../../kernel/chain/capability.js';
import type { ChainOf } from '../../kernel/chain/chain.js';
import type { Started } from '../../kernel/chain/config.js';
import { defineFacet } from '../../kernel/chain/define-facet.js';
import { headers } from '../../kernel/context/headers.capability.js';
import { sharing } from '../../kernel/context/with.capability.js';
import { getCallerDir } from '../../kernel/files/caller.js';
import { clock } from '../../world/clock/clock.capability.js';
import { stubBackend } from '../../world/stubs/delivery/other-process/stub-backend.adapter.js';
import { intercept } from '../../world/stubs/intercept/intercept.capability.js';
import { pageClock } from './browser/clock.driver.js';
/* oxlint-disable typescript/consistent-type-definitions, typescript/no-empty-object-type -- the chain is an empty interface over its computed type: the compiler prints an interface by its name, where an alias of a computed type may print expanded */
import { rawFetch } from './fetch/fetch.action.js';
import { visit } from './visit/visit.action.js';
import type { WebsiteConfig, WebsiteSpecificationOptions } from './website.handle.js';

const composition = {
    actions: [visit, rawFetch],
    capabilities: [clock, headers, intercept, sharing],
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

export const websiteFacet = defineFacet<WebsiteSpecification, Started<WebsiteConfig, 'browser'>>()({
    ...composition,
    drivers: (config: Started<WebsiteConfig, 'browser'>) => ({
        browser: config.browser,
        clock: pageClock,
        network: stubBackend(config.backend, 'website'),
    }),
    locate: getCallerDir,
});
