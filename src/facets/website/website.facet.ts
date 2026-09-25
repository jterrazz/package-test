/* oxlint-disable typescript/consistent-type-definitions, typescript/no-empty-object-type -- the chain is an empty interface over its computed type: the compiler prints an interface by its name, where an alias of a computed type may print expanded */
import { rawFetch } from '../../actions/fetch/fetch.action.js';
import { visit } from '../../actions/visit/visit.action.js';
import { clock } from '../../capabilities/clock/clock.capability.js';
import { headers } from '../../capabilities/headers/headers.capability.js';
import { intercept } from '../../capabilities/intercept/intercept.capability.js';
import { sharing } from '../../capabilities/with/with.capability.js';
import { getCallerDir } from '../../model/chain/caller.js';
import type { MatrixRow } from '../../model/chain/capability.js';
import type { SpecificationConfig } from '../../model/chain/config.js';
import { pageClock } from '../../seams/playwright/page-clock.js';
import { stubBackend } from '../../seams/stub-backend/stub-backend.engine.js';
import type { ChainOf } from '../chain.js';
import { defineFacet, required } from '../define-facet.js';
import type { WebsiteSpecificationOptions } from './website.handle.js';

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

/**
 * The `website` facet — page chain entry handed out by
 * `specification.website()`. Setup methods chain; action methods are
 * terminal. `.visit()` renders the page in the shared browser; `.fetch()`
 * performs one raw HTTP exchange and never follows redirects. The site runs
 * in its own process: the clock pinned is the PAGE's, and the contracts are
 * served by the declared stub backend.
 */
export interface WebsiteSpecification extends ChainOf<
    typeof composition,
    { databaseKey: string; services: Record<string, unknown> },
    WebsiteSpecification
> {}

export const websiteFacet = defineFacet<WebsiteSpecification>()({
    ...composition,
    engines: (config: SpecificationConfig) => ({
        browser: required(config.browser, 'browser'),
        clock: pageClock,
        network: stubBackend(config.backend, 'website'),
    }),
    locate: getCallerDir,
});
