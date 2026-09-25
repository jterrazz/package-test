import type { MatrixRow } from '../../kernel/chain/capability.js';
import type { ChainOf } from '../../kernel/chain/chain.js';
import type { Started } from '../../kernel/chain/config.js';
import { defineFacet } from '../../kernel/chain/define-facet.js';
import { sharing } from '../../kernel/context/with.capability.js';
import { getCallerDir } from '../../kernel/files/caller.js';
import { clock } from '../../world/clock/clock.capability.js';
import { processClock } from '../../world/clock/clock.engine.js';
import { databaseSet } from '../../world/services/seed/database-set.engine.js';
import { seed } from '../../world/services/seed/seed.capability.js';
import type { ServicesConfig } from '../../world/services/services.js';
import { intercept } from '../../world/stubs/intercept/intercept.capability.js';
import { mswNode } from '../../world/stubs/network/msw-node.engine.js';
/* oxlint-disable typescript/consistent-type-definitions, typescript/no-empty-object-type -- the chain is an empty interface over its computed type: the compiler prints an interface by its name, where an alias of a computed type may print expanded */
import { call } from './call.action.js';
import type { IntegrationSpecificationOptions } from './integration.handle.js';

const composition = {
    actions: [call],
    capabilities: [clock, intercept, seed, sharing],
    options: {
        root: { group: 'Constructor option', name: 'root', probe: 'root:' },
        services: { group: 'Constructor option', name: 'services', probe: 'services:' },
    } satisfies Record<keyof IntegrationSpecificationOptions, MatrixRow>,
} as const;

/**
 * The `integration` facet — the chain `specification.integration()` hands
 * out. The subject is a MODULE, not an entry: no HTTP, no binary, no page.
 * What makes it a spec rather than a module test is what it stands on — real
 * services, declared stubs, a golden — so it takes the same setups as
 * every other facet and ends on the one action a module has: being called.
 * It runs in this process: the clock pinned is this process's, the network
 * intercepted is this process's.
 *
 * `Services` is the declared record `.call()` hands the module; `DatabaseKey`
 * the typed vocabulary of `.seed()`, its keys that are databases.
 */
export interface IntegrationSpecification<
    Services extends Record<string, unknown> = Record<string, unknown>,
    DatabaseKey extends string = string,
> extends ChainOf<
    typeof composition,
    { databaseKey: DatabaseKey; services: Services },
    IntegrationSpecification<Services, DatabaseKey>
> {}

export const integrationFacet = defineFacet<
    IntegrationSpecification,
    Started<ServicesConfig, 'services'>
>()({
    ...composition,
    engines: (config: Started<ServicesConfig, 'services'>) => ({
        clock: processClock,
        databases: databaseSet(config),
        network: mswNode,
        services: config.services,
    }),
    locate: getCallerDir,
});
