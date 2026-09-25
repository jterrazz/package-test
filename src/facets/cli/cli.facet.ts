/* oxlint-disable typescript/consistent-type-definitions, typescript/no-empty-object-type -- the chain is an empty interface over its computed type: the compiler prints an interface by its name, where an alias of a computed type may print expanded */
import { exec } from '../../actions/exec/exec.action.js';
import { run } from '../../actions/run/run.action.js';
import { env } from '../../capabilities/env/env.capability.js';
import { fixture } from '../../capabilities/fixture/fixture.capability.js';
import { seed } from '../../capabilities/seed/seed.capability.js';
import { sharing } from '../../capabilities/with/with.capability.js';
import { getCallerDir } from '../../model/chain/caller.js';
import type { MatrixRow } from '../../model/chain/capability.js';
import type { StartedWith } from '../../model/chain/config.js';
import { databaseSet } from '../../seams/fs/database-set.js';
import { fsFixtures } from '../../seams/fs/fixtures.js';
import type { ChainOf } from '../chain.js';
import { defineFacet } from '../define-facet.js';
import type { CliSpecificationOptions } from './cli.handle.js';

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

/**
 * The `cli` facet — the chain `specification.cli()` hands out. The subject
 * is a binary run in a fresh, empty working directory, in its own process:
 * its clock and its network are its own, so the chain states the ground it
 * stands on — files, environment, seeded databases — and `.exec()` is the
 * one way to run it (CONVENTIONS B2), `.run()` the document that runs it
 * several times over one directory.
 *
 * The `DatabaseKey` parameter is the typed vocabulary of `.seed()`: the keys
 * of the declared services record that are databases.
 */
export interface CliSpecification<DatabaseKey extends string = string> extends ChainOf<
    typeof composition,
    { databaseKey: DatabaseKey; services: Record<string, unknown> },
    CliSpecification<DatabaseKey>
> {}

export const cliFacet = defineFacet<CliSpecification, StartedWith<'command'>>()({
    ...composition,
    engines: (config: StartedWith<'command'>) => ({
        command: config.command,
        databases: databaseSet(config),
        workdir: fsFixtures,
    }),
    locate: getCallerDir,
});
