/* oxlint-disable typescript/no-empty-object-type -- the chain is an empty interface over its computed type: the compiler prints an interface by its name, where an alias of a computed type may print expanded */
import type { MatrixRow } from '../../chain/capability.js';
import type { ChainOf } from '../../chain/chain.js';
import { headers } from '../../chain/context/headers.capability.js';
import { sharing } from '../../chain/context/with.capability.js';
import { defineSpecification } from '../../chain/define-specification.js';
import { getCallerDir } from '../../chain/paths/caller.js';
import type { DeploymentConfig, DeploymentSpecificationOptions } from './deployment.handle.js';
import { connect } from './exchange/connect.capability.js';
import { get, request } from './exchange/request.action.js';

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
    } satisfies Record<keyof DeploymentSpecificationOptions, MatrixRow>,
} as const;

/** The chain `specification.deployment()` hands out: one HTTP exchange with a running deployment, over the network. */
export interface DeploymentSpecification extends ChainOf<
    typeof composition,
    { databaseKey: string; services: Record<string, unknown> },
    DeploymentSpecification
> {}

export const deploymentDefinition = defineSpecification<
    DeploymentSpecification,
    DeploymentConfig
>()({
    ...composition,
    adapters: (_config: DeploymentConfig) => ({}),
    locate: getCallerDir,
});
