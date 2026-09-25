import type { DiskFile } from '../../model/chain/spec-path.js';

/** What `.seed()` takes: a `.sql` file, never the statements themselves — SQL is not written in a test. */
export type SeedSource = DiskFile<'.sql'>;

/** `.seed(file, { database })`, handing back the chain it was called on. */
export type SeedMethod<Self, DatabaseKey extends string> = (
    source: SeedSource,
    options?: { database?: DatabaseKey },
) => Self;
