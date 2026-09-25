import { defineCapability } from '../../../kernel/chain/capability.js';
import { validateDatabaseOption } from '../../../kernel/chain/database-option.js';
import { requireDiskFile } from '../../../kernel/files/spec-path.js';
import type { DiskFile } from '../../../kernel/files/spec-path.js';
import type { SeedPort } from './seed.port.js';

/** What `.seed()` takes: a `.sql` file, never the statements themselves — SQL is not written in a test. */
export type SeedSource = DiskFile<'.sql'>;

/** `.seed(file, { database })`, handing back the chain it was called on. */
export type SeedMethod<Self, DatabaseKey extends string> = (
    source: SeedSource,
    options?: { database?: DatabaseKey },
) => Self;

/** One queued seed: the file, relative to the test, and the database it names. */
type QueuedSeed = { readonly database: string | undefined; readonly path: string };

/**
 * `.seed(file, { database })`: a SQL file run before the action, after every
 * declared database is emptied. The path and the `database` option are judged
 * when the setup is stated (CONVENTIONS A7); the file is read when the chain
 * is armed.
 */
export const seed = defineCapability<
    'seed',
    readonly QueuedSeed[],
    [source: SeedSource, options?: { database?: string }],
    { databases: SeedPort }
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
