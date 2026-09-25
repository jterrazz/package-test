/* oxlint-disable typescript/consistent-type-definitions, typescript/no-empty-object-type -- the chain is an empty interface over its computed type: the compiler prints an interface by its name, where an alias of a computed type may print expanded */
import { del, get, post, put, request } from '../../actions/request/request.action.js';
import { clock } from '../../capabilities/clock/clock.capability.js';
import { headers } from '../../capabilities/headers/headers.capability.js';
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
import { defineFacet, required } from '../define-facet.js';
import type { ApiSpecificationOptions } from './api.handle.js';

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

export const apiFacet = defineFacet<ApiSpecification>()({
    ...composition,
    engines: (config: SpecificationConfig) => ({
        clock: processClock,
        databases: databaseSet(config),
        network: mswNode,
        server: required(config.server, 'server'),
    }),
    locate: getCallerDir,
});
