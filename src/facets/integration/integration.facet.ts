/* oxlint-disable typescript/consistent-type-definitions, typescript/no-empty-object-type -- the chain is an empty interface over its computed type: the compiler prints an interface by its name, where an alias of a computed type may print expanded */
import { call } from '../../actions/call/call.action.js';
import { clock } from '../../capabilities/clock/clock.capability.js';
import { intercept } from '../../capabilities/intercept/intercept.capability.js';
import { seed } from '../../capabilities/seed/seed.capability.js';
import { sharing } from '../../capabilities/with/with.capability.js';
import { getCallerDir } from '../../model/chain/caller.js';
import type { MatrixRow } from '../../model/chain/capability.js';
import type { SpecificationConfig } from '../../model/chain/config.js';
import { databaseSet } from '../../seams/fs/database-set.js';
import { mswNode } from '../../seams/msw/msw-node.js';
import { processClock } from '../../seams/vitest/clock.engine.js';
import type { ChainOf } from '../chain.js';
import { defineFacet } from '../define-facet.js';
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
 * services, declared contracts, a golden — so it takes the same setups as
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

export const integrationFacet = defineFacet<IntegrationSpecification>()({
    ...composition,
    engines: (config: SpecificationConfig) => ({
        clock: processClock,
        databases: databaseSet(config),
        network: mswNode,
        services: config.services ?? {},
    }),
    locate: getCallerDir,
});
