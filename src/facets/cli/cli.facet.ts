import type { MatrixRow } from '../../kernel/chain/capability.js';
import type { ChainOf } from '../../kernel/chain/chain.js';
import type { Started } from '../../kernel/chain/config.js';
import { defineFacet } from '../../kernel/chain/define-facet.js';
import { sharing } from '../../kernel/context/with.capability.js';
import { getCallerDir } from '../../kernel/files/caller.js';
import { databaseSet } from '../../world/services/seed/database-set.adapter.js';
import { seed } from '../../world/services/seed/seed.capability.js';
import type { CliConfig, CliSpecificationOptions } from './cli.handle.js';
import { run } from './documents/run.action.js';
import { fixture } from './fixture/fixture.capability.js';
import { fsFixtures } from './fixture/fs-fixtures.adapter.js';
import { env } from './process/env.capability.js';
/* oxlint-disable typescript/consistent-type-definitions, typescript/no-empty-object-type -- the chain is an empty interface over its computed type: the compiler prints an interface by its name, where an alias of a computed type may print expanded */
import { exec } from './process/exec.action.js';

const composition = {
    actions: [exec, run],
    capabilities: [env, fixture, seed, sharing],
    options: {
        commands: { group: 'Constructor option', name: 'commands', probe: 'commands:' },
        defaults: { group: 'Constructor option', name: 'defaults', probe: 'defaults:' },
        docker: { group: 'Constructor option', name: 'docker', probe: 'docker:' },
        env: { group: 'Constructor option', name: 'env', probe: 'env:' },
        root: { group: 'Constructor option', name: 'root', probe: 'root:' },
        serve: { group: 'Constructor option', name: 'serve', probe: 'serve:' },
        services: { group: 'Constructor option', name: 'services', probe: 'services:' },
        transform: { group: 'Constructor option', name: 'transform', probe: 'transform:' },
    } satisfies Record<keyof CliSpecificationOptions, MatrixRow>,
} as const;

/** The chain `specification.cli()` hands out: a binary run in a fresh, empty working directory, in its own process. */
export interface CliSpecification<DatabaseKey extends string = string> extends ChainOf<
    typeof composition,
    { databaseKey: DatabaseKey; services: Record<string, unknown> },
    CliSpecification<DatabaseKey>
> {}

export const cliFacet = defineFacet<CliSpecification, Started<CliConfig, 'command'>>()({
    ...composition,
    adapters: (config: Started<CliConfig, 'command'>) => ({
        command: config.command,
        databases: databaseSet(config),
        workdir: fsFixtures,
    }),
    locate: getCallerDir,
});
