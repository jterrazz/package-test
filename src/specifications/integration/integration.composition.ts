/* oxlint-disable typescript/no-empty-object-type -- the chain is an empty interface over its computed type: the compiler prints an interface by its name, where an alias of a computed type may print expanded */
import type { MatrixRow } from '../../chain/capability.js';
import type { ChainOf } from '../../chain/chain.js';
import type { Started } from '../../chain/config.js';
import { sharing } from '../../chain/context/with.capability.js';
import { defineSpecification } from '../../chain/define-specification.js';
import { getCallerDir } from '../../chain/paths/caller.js';
import { clock } from '../../clock/clock.capability.js';
import { processClock } from '../../clock/process-clock.adapter.js';
import { databaseSet } from '../../services/seed/database-set.adapter.js';
import { seed } from '../../services/seed/seed.capability.js';
import type { ServicesConfig } from '../../services/services.js';
import { mswNode } from '../../stubs/delivery/same-process/msw-node.adapter.js';
import { intercept } from '../../stubs/intercept/intercept.capability.js';
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

/** The chain `specification.integration()` hands out: the subject is a module, run in this process. */
export interface IntegrationSpecification<
    Services extends Record<string, unknown> = Record<string, unknown>,
    DatabaseKey extends string = string,
> extends ChainOf<
    typeof composition,
    { databaseKey: DatabaseKey; services: Services },
    IntegrationSpecification<Services, DatabaseKey>
> {}

export const integrationDefinition = defineSpecification<
    IntegrationSpecification,
    Started<ServicesConfig, 'services'>
>()({
    ...composition,
    adapters: (config: Started<ServicesConfig, 'services'>) => ({
        clock: processClock,
        databases: databaseSet(config),
        network: mswNode,
        services: config.services,
    }),
    locate: getCallerDir,
});
