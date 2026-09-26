import { defineCapability } from '../../../kernel/chain/capability.js';
import type { ChainSignature } from '../../../kernel/chain/capability.js';
import { validateDatabaseOption } from '../../../kernel/database-option.js';
import { requireDiskFile } from '../../../kernel/files/spec-path.js';
import type { DiskFile } from '../../../kernel/files/spec-path.js';
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
    /** Queue a SQL seed — `file('./_seeds/<name>.sql')` — to run before the action. */
    seed: SeedMethod<Self, DatabaseKey>;
};

// oxlint-disable-next-line typescript/consistent-type-definitions -- a signature is read through `this`, which only an interface can name
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
            // oxlint-disable-next-line eslint/no-await-in-loop -- seeds run in the order the chain stated them: a later one may read what an earlier one wrote
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
