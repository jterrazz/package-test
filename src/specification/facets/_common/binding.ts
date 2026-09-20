/**
 * The case conversions a services-record key goes through.
 *
 * A record key is written in the natural TypeScript style (`analyticsDb`),
 * while the two vocabularies it feeds are not: a service DIRECTORY under
 * `docker/` is kebab-case (`analytics-db`), and an injected environment
 * variable is CONSTANT_CASE (`ANALYTICS_DB_URL`). These two helpers bridge
 * them deterministically, so the record key stays the single source of truth
 * and no handle carries a second name of its own.
 */

/**
 * Convert a record key to its kebab-case form: camelCase boundaries become
 * `-`, everything is lowercased. `analyticsDb` → `analytics-db`, `db` → `db`.
 */
export function toKebabCase(key: string): string {
    return key.replaceAll(/(?<lower>[a-z0-9])(?<upper>[A-Z])/gu, '$<lower>-$<upper>').toLowerCase();
}

/**
 * Convert a record key to CONSTANT_CASE for env injection: insert `_` at
 * camelCase boundaries, map any remaining non-alphanumeric run to `_`, then
 * uppercase. `analyticsDb` → `ANALYTICS_DB`, `db-main` → `DB_MAIN`, `db` → `DB`.
 */
export function toConstantCase(key: string): string {
    return key
        .replaceAll(/(?<lower>[a-z0-9])(?<upper>[A-Z])/gu, '$<lower>_$<upper>')
        .replaceAll(/[^A-Za-z0-9]/gu, '_')
        .toUpperCase();
}
