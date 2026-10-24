/* oxlint-disable typescript/no-empty-object-type -- the chain is an empty interface over its computed type: the compiler prints an interface by its name, where an alias of a computed type may print expanded */
import type { MatrixRow } from '../../../chain/capability.js';
import type { ChainOf } from '../../../chain/chain.js';
import { headers } from '../../../chain/context/headers.capability.js';
import { sharing } from '../../../chain/context/with.capability.js';
import { defineSpecification } from '../../../chain/define-specification.js';
import { getCallerDir } from '../../../chain/paths/caller.js';
import type { ApiDeployedConfig, ApiDeployedOptions } from '../api.handle.js';
import { connect } from './connect.capability.js';
import { get, request } from './request.action.js';

// invariant: a deployed api runs elsewhere, so its chain composes what a request can do and nothing that reaches into the app: no seed, no stub, no clock.
const composition = {
    actions: [request, get],
    capabilities: [connect, headers, sharing],
    options: {
        ca: { group: 'Constructor option', name: 'ca', probe: 'ca:' },
        insecure: { group: 'Constructor option', name: 'insecure', probe: 'insecure:' },
        recordedHeaders: {
            group: 'Constructor option',
            name: 'recordedHeaders',
            probe: 'recordedHeaders:',
        },
        timeout: { group: 'Constructor option', name: 'timeout', probe: 'timeout:' },
        url: { group: 'Constructor option', name: 'url', probe: 'url:' },
    } satisfies Record<keyof ApiDeployedOptions, MatrixRow>,
} as const;

/** The chain `specification.api({ url })` hands out: requests to the deployed api, over the network. */
export interface ApiDeployedSpecification extends ChainOf<
    typeof composition,
    { databaseKey: string; services: Record<string, unknown> },
    ApiDeployedSpecification
> {}

export const apiDeployedDefinition = defineSpecification<
    ApiDeployedSpecification,
    ApiDeployedConfig
>()({
    ...composition,
    adapters: (_config: ApiDeployedConfig) => ({}),
    locate: getCallerDir,
});
