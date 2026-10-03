import { refusal } from '../chain/refusals/refusal.js';

/** Enforces rule `database-named-only-when-several`. */
export function validateDatabaseOption(
    method: string,
    config: { readonly databaseKeys?: readonly string[] | undefined },
    database?: string,
): void {
    const keys = config.databaseKeys;
    if (!keys) {
        return;
    }
    if (keys.length >= 2 && database === undefined) {
        throw new Error(
            refusal('database-named-only-when-several-at-runtime', {
                fix: `pass the database it reads: { database: '${keys[0]}' }, or another declared key`,
                found: `${method}() names no database, and ${keys.length} databases are declared (${keys.map((k) => `"${k}"`).join(', ')})`,
            }),
        );
    }
    if (keys.length === 1 && database !== undefined) {
        throw new Error(
            refusal('database-named-only-when-several-at-runtime', {
                fix: `delete { database: '${database}' }`,
                found: `${method}() names a database, and "${keys[0]}" is the only one declared`,
            }),
        );
    }
}
