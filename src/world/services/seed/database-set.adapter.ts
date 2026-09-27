import { readFileSync } from 'node:fs';

import { refusal } from '../../../../lint/index.refusal.js';
import { resolveSpecPath } from '../../../kernel/files/resolved-spec-path.js';
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
                        refusal({
                            fix: `name a declared database: ${[...config.databases.keys()].join(', ')}`,
                            found: `seed() targets the database "${database}", and none is declared under that key`,
                            read: 'docs/17-services.md#the-database-rule',
                            why: '`database:` names a key of the services record.',
                        }),
                    );
                }
                return named;
            }
            if (!config.database) {
                throw new Error(
                    refusal({
                        fix: 'declare a database in the specification’s `services` — `postgres()` or `sqlite()` — or drop the seed',
                        found: 'seed(), and no database is declared',
                        read: 'docs/17-services.md#the-database-rule',
                        why: 'A seed writes into a declared database.',
                    }),
                );
            }
            return config.database;
        },
    };
}
