import type { DatabasePort } from '../database.port.js';

export type SeedPort = {
    readonly read: (path: string, testDir: string) => string;
    /** Empty every declared database, whether the chain queued a seed or not. */
    readonly reset: () => Promise<void>;
    /** The database a seed names, the only one when it names none. */
    readonly target: (database?: string) => DatabasePort;
};
