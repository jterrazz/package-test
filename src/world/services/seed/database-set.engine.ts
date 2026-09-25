import { readFileSync } from 'node:fs';

import { resolveSpecPath } from '../../../kernel/files/resolve.js';
import type { ServicesConfig } from '../services.js';
import type { SeedPort } from './seed.port.js';

export function databaseSet(config: ServicesConfig): SeedPort {
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
