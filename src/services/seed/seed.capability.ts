import { defineCapability } from '../../chain/capability.js';
import type { ChainSignature } from '../../chain/capability.js';
import { requireDiskFile } from '../../disk/spec-path.js';
import type { DiskFile } from '../../disk/spec-path.js';
import { validateDatabaseOption } from '../database-option.js';
import type { ServicesConfig } from '../services.js';
import type { SeedPort } from './seed.port.js';

/** What `.seed()` takes: a `.sql` file, never the statements themselves — SQL is not written in a test. */
export type SeedSource = DiskFile<'.sql'>;

export type SeedMethod<Self, DatabaseKey extends string> = (
    source: SeedSource,
    options?: { database?: DatabaseKey },
) => Self;

type QueuedSeed = { readonly database: string | undefined; readonly path: string };

export type SeedChain<Self, DatabaseKey extends string> = {
    /** Queue a SQL seed — `file('./__seeds__/<name>.sql')` — to run before the action. */
    seed: SeedMethod<Self, DatabaseKey>;
};

export interface SeedSignature extends ChainSignature {
    readonly chain: SeedChain<this['self'], this['params']['databaseKey']>;
}

/** The path and the `database` option are judged when stated (`database-named-only-when-several`); the file is read when the chain is armed. */
export const seed = defineCapability<
    'seed',
    readonly QueuedSeed[],
    [source: SeedSource, options?: { database?: string }],
    SeedSignature,
    { databases: SeedPort },
    never,
    ServicesConfig
>({
    arm: async (queued, { databases }, { testDir }) => {
        await databases.reset();
        for (const entry of queued) {
            await databases.target(entry.database).seed(databases.read(entry.path, testDir));
        }
        return {};
    },
    initial: [],
    name: 'seed',
    phase: 10,
    reduce: (queued, [source, options], { config }) => {
        const { path } = requireDiskFile('seed', source, '.sql');
        validateDatabaseOption('seed', config, options?.database);
        return [...queued, { database: options?.database, path }];
    },
    row: { group: 'Setup', name: '.seed()', probe: '.seed(file(' },
});
