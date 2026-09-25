import type { MatrixRow } from '../../kernel/chain/capability.js';
import type { ChainOf } from '../../kernel/chain/chain.js';
import type { StartedWith } from '../../kernel/chain/config.js';
import { defineFacet } from '../../kernel/chain/define-facet.js';
import { headers } from '../../kernel/context/headers.capability.js';
import { sharing } from '../../kernel/context/with.capability.js';
import { getCallerDir } from '../../kernel/files/caller.js';
import { clock } from '../../world/clock/clock.capability.js';
import { stubBackend } from '../../world/stubs/backend/stub-backend.engine.js';
import { intercept } from '../../world/stubs/intercept/intercept.capability.js';
import { pageClock } from './browser/page-clock.js';
/* oxlint-disable typescript/consistent-type-definitions, typescript/no-empty-object-type -- the chain is an empty interface over its computed type: the compiler prints an interface by its name, where an alias of a computed type may print expanded */
import { rawFetch } from './fetch/fetch.action.js';
import { visit } from './visit/visit.action.js';
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
 * in its own process: the clock pinned is the PAGE's, and the stubs are
 * served by the declared stub backend.
 */
export interface WebsiteSpecification extends ChainOf<
    typeof composition,
    { databaseKey: string; services: Record<string, unknown> },
    WebsiteSpecification
> {}

export const websiteFacet = defineFacet<WebsiteSpecification, StartedWith<'browser'>>()({
    ...composition,
    engines: (config: StartedWith<'browser'>) => ({
        browser: config.browser,
        clock: pageClock,
        network: stubBackend(config.backend, 'website'),
    }),
    locate: getCallerDir,
});
