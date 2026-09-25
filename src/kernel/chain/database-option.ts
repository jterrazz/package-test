import { refusal } from '../refusals/refusal.js';
import type { SpecificationConfig } from './config.js';

/**
 * Enforce CONVENTIONS A7: with two or more databases in the services record
 * the `database` option is mandatory on `.seed()` / `.table()`; with exactly
 * one it is forbidden (redundant).
 *
 * @internal
 */
export function validateDatabaseOption(
    method: string,
    config: SpecificationConfig,
    database: string | undefined,
): void {
    const keys = config.databaseKeys;
    if (!keys) {
        return;
    }
    if (keys.length >= 2 && !database) {
        throw new Error(
            refusal('a7-database-runtime', {
                fix: `pass the database it reads: { database: '${keys[0]}' }, or another declared key`,
                found: `${method}() names no database, and ${keys.length} databases are declared (${keys.map((k) => `"${k}"`).join(', ')})`,
            }),
        );
    }
    if (keys.length === 1 && database) {
        throw new Error(
            refusal('a7-database-runtime', {
                fix: `delete { database: '${database}' }`,
                found: `${method}() names a database, and "${keys[0]}" is the only one declared`,
            }),
        );
    }
}
