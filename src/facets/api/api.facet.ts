import type { MatrixRow } from '../../kernel/chain/capability.js';
import type { ChainOf } from '../../kernel/chain/chain.js';
import type { Started } from '../../kernel/chain/config.js';
import { defineFacet } from '../../kernel/chain/define-facet.js';
import { headers } from '../../kernel/context/headers.capability.js';
import { sharing } from '../../kernel/context/with.capability.js';
import { getCallerDir } from '../../kernel/files/caller.js';
import { clock } from '../../world/clock/clock.capability.js';
import { processClock } from '../../world/clock/clock.engine.js';
import { databaseSet } from '../../world/services/seed/database-set.js';
import { seed } from '../../world/services/seed/seed.capability.js';
import { intercept } from '../../world/stubs/intercept/intercept.capability.js';
import { mswNode } from '../../world/stubs/interceptor/msw-node.js';
import type { ApiConfig, ApiSpecificationOptions } from './api.handle.js';
/* oxlint-disable typescript/consistent-type-definitions, typescript/no-empty-object-type -- the chain is an empty interface over its computed type: the compiler prints an interface by its name, where an alias of a computed type may print expanded */
import { del, get, post, put, request } from './request/request.action.js';

const composition = {
    actions: [request, get, post, put, del],
    capabilities: [clock, headers, intercept, seed, sharing],
    options: {
        root: { group: 'Constructor option', name: 'root', probe: 'root:' },
        server: { group: 'Constructor option', name: 'server', probe: 'server:' },
        services: { group: 'Constructor option', name: 'services', probe: 'services:' },
    } satisfies Record<keyof ApiSpecificationOptions, MatrixRow>,
} as const;

/**
 * The `api` facet — HTTP chain entry handed out by `specification.api()`.
 * Setup methods chain; action methods are terminal: they execute the spec
 * and resolve to the result. The app answers in this process (CONVENTIONS
 * A8): the clock pinned is this process's, the network intercepted is this
 * process's.
 *
 * The `DatabaseKey` parameter is the typed vocabulary of `.seed()`: the keys
 * of the declared services record that are databases.
 */
export interface ApiSpecification<DatabaseKey extends string = string> extends ChainOf<
    typeof composition,
    { databaseKey: DatabaseKey; services: Record<string, unknown> },
    ApiSpecification<DatabaseKey>
> {}

export const apiFacet = defineFacet<ApiSpecification, Started<ApiConfig, 'server'>>()({
    ...composition,
    engines: (config: Started<ApiConfig, 'server'>) => ({
        clock: processClock,
        databases: databaseSet(config),
        network: mswNode,
        server: config.server,
    }),
    locate: getCallerDir,
});
