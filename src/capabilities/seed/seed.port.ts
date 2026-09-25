import type { DatabasePort } from '../../model/ports/database.port.js';

/** The databases a chain seeds, and how a seed file is read — the only way `.seed()` reaches them. */
export type SeedPort = {
    /** A seed file's statements, read from the path the chain named relative to `testDir`. */
    readonly read: (path: string, testDir: string) => string;
    /** Empty every declared database — before any seed, whether the chain queued one or not. */
    readonly reset: () => Promise<void>;
    /** The database a seed names — the only one when it names none; refused when there is none. */
    readonly target: (database: string | undefined) => DatabasePort;
};
