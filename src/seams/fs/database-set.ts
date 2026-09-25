import { readFileSync } from 'node:fs';

import type { SpecificationConfig } from '../../model/chain/config.js';
import { resolveSpecPath } from '../../model/chain/resolve.js';
import type { DatabasePort } from '../../model/ports/database.port.js';

/**
 * The databases a constructor declared, as a chain seeds them: every one
 * emptied, a seed file read from the test's directory, and the database a seed
 * names looked up — the only one when it names none.
 */
export function databaseSet(config: SpecificationConfig): {
    readonly read: (path: string, testDir: string) => string;
    readonly reset: () => Promise<void>;
    readonly target: (database: string | undefined) => DatabasePort;
} {
    return {
        read: (path, testDir) => readFileSync(resolveSpecPath('seed', path, testDir), 'utf8'),
        reset: async () => {
            if (config.databases) {
                for (const database of config.databases.values()) {
                    // oxlint-disable-next-line eslint/no-await-in-loop -- one database at a time, as the constructor declared them
                    await database.reset();
                }
            } else if (config.database) {
                await config.database.reset();
            }
        },
        target: (database) => {
            if (database !== undefined && database !== '' && config.databases) {
                const named = config.databases.get(database);
                if (!named) {
                    throw new Error(
                        `seed() targets database "${database}" but it was not found. Available: ${[...config.databases.keys()].join(', ')}`,
                    );
                }
                return named;
            }
            if (!config.database) {
                throw new Error('seed() requires a database adapter');
            }
            return config.database;
        },
    };
}
