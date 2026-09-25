import type { MatrixRow } from '../../kernel/chain/capability.js';
import type { ChainOf } from '../../kernel/chain/chain.js';
import type { SpecificationConfig } from '../../kernel/chain/config.js';
import { defineFacet } from '../../kernel/chain/define-facet.js';
import { sharing } from '../../kernel/context/with.capability.js';
import { getCallerDir } from '../../kernel/files/caller.js';
import { clock } from '../../world/clock/clock.capability.js';
import { processClock } from '../../world/clock/clock.engine.js';
import { databaseSet } from '../../world/services/seed/database-set.js';
import { seed } from '../../world/services/seed/seed.capability.js';
import { intercept } from '../../world/stubs/intercept/intercept.capability.js';
import { mswNode } from '../../world/stubs/interceptor/msw-node.js';
import type { JobSpecificationOptions } from './job.handle.js';
/* oxlint-disable typescript/consistent-type-definitions, typescript/no-empty-object-type -- the chain is an empty interface over its computed type: the compiler prints an interface by its name, where an alias of a computed type may print expanded */
import { trigger } from './trigger.action.js';

const composition = {
    actions: [trigger],
    capabilities: [clock, intercept, seed, sharing],
    options: {
        jobs: { group: 'Constructor option', name: 'jobs', probe: 'jobs:' },
        root: { group: 'Constructor option', name: 'root', probe: 'root:' },
        services: { group: 'Constructor option', name: 'services', probe: 'services:' },
    } satisfies Record<keyof JobSpecificationOptions, MatrixRow>,
} as const;

/**
 * The `job` facet — the chain `specification.job()` hands out. Jobs run in
 * this process by definition (CONVENTIONS A8): the clock pinned is this
 * process's, the network intercepted is this process's.
 *
 * The `DatabaseKey` parameter is the typed vocabulary of `.seed()`: the keys
 * of the declared services record that are databases.
 */
export interface JobSpecification<DatabaseKey extends string = string> extends ChainOf<
    typeof composition,
    { databaseKey: DatabaseKey; services: Record<string, unknown> },
    JobSpecification<DatabaseKey>
> {}

export const jobFacet = defineFacet<JobSpecification>()({
    ...composition,
    engines: (config: SpecificationConfig) => ({
        clock: processClock,
        databases: databaseSet(config),
        jobs: config.jobs ?? [],
        network: mswNode,
    }),
    locate: getCallerDir,
});
