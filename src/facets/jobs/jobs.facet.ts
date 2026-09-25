/* oxlint-disable typescript/consistent-type-definitions, typescript/no-empty-object-type -- the chain is an empty interface over its computed type: the compiler prints an interface by its name, where an alias of a computed type may print expanded */
import { trigger } from '../../actions/trigger/trigger.action.js';
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
import type { JobsSpecificationOptions } from './jobs.handle.js';

const composition = {
    actions: [trigger],
    capabilities: [clock, intercept, seed, sharing],
    options: {
        jobs: { group: 'Constructor option', name: 'jobs', probe: 'jobs:' },
        root: { group: 'Constructor option', name: 'root', probe: 'root:' },
        services: { group: 'Constructor option', name: 'services', probe: 'services:' },
    } satisfies Record<keyof JobsSpecificationOptions, MatrixRow>,
} as const;

/**
 * The `jobs` facet — the chain `specification.jobs()` hands out. Jobs run in
 * this process by definition (CONVENTIONS A8): the clock pinned is this
 * process's, the network intercepted is this process's.
 *
 * The `DatabaseKey` parameter is the typed vocabulary of `.seed()`: the keys
 * of the declared services record that are databases.
 */
export interface JobsSpecification<DatabaseKey extends string = string> extends ChainOf<
    typeof composition,
    { databaseKey: DatabaseKey; services: Record<string, unknown> },
    JobsSpecification<DatabaseKey>
> {}

export const jobsFacet = defineFacet<JobsSpecification>()({
    ...composition,
    engines: (config: SpecificationConfig) => ({
        clock: processClock,
        databases: databaseSet(config),
        jobs: config.jobs ?? [],
        network: mswNode,
    }),
    locate: getCallerDir,
});
