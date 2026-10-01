/* oxlint-disable typescript/consistent-type-definitions, typescript/no-empty-object-type -- the chain is an empty interface over its computed type: the compiler prints an interface by its name, where an alias of a computed type may print expanded */
import type { MatrixRow } from '../../chain/capability.js';
import type { ChainOf } from '../../chain/chain.js';
import type { Started } from '../../chain/config.js';
import { headers } from '../../chain/context/headers.capability.js';
import { sharing } from '../../chain/context/with.capability.js';
import { defineFacet } from '../../chain/define-facet.js';
import { getCallerDir } from '../../chain/paths/caller.js';
import { clock } from '../../clock/clock.capability.js';
import { processClock } from '../../clock/process-clock.adapter.js';
import { databaseSet } from '../../services/seed/database-set.adapter.js';
import { seed } from '../../services/seed/seed.capability.js';
import { mswNode } from '../../stubs/delivery/same-process/msw-node.adapter.js';
import { intercept } from '../../stubs/intercept/intercept.capability.js';
import type { ApiConfig, ApiSpecificationOptions } from './api.handle.js';
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

/** The chain `specification.api()` hands out; the app answers in this process (`server-sees-declared-services`). */
export interface ApiSpecification<DatabaseKey extends string = string> extends ChainOf<
    typeof composition,
    { databaseKey: DatabaseKey; services: Record<string, unknown> },
    ApiSpecification<DatabaseKey>
> {}

export const apiFacet = defineFacet<ApiSpecification, Started<ApiConfig, 'server'>>()({
    ...composition,
    adapters: (config: Started<ApiConfig, 'server'>) => ({
        clock: processClock,
        databases: databaseSet(config),
        network: mswNode,
        server: config.server,
    }),
    locate: getCallerDir,
});
