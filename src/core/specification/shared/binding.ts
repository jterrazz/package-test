/**
 * Compose-binding resolution and the case conversions it shares with the
 * automatic env injection (CONVENTIONS A6 / B6).
 *
 * A services-record key is written in the natural TypeScript style
 * (`analyticsDb`), while a compose service name is kebab-case
 * (`analytics-db`). These helpers bridge the two vocabularies deterministically
 * so the record key stays the single source of truth and `composeService`
 * remains a rare escape hatch.
 */

/**
 * Convert a record key to its kebab-case form: camelCase boundaries become
 * `-`, everything is lowercased. `analyticsDb` → `analytics-db`, `db` → `db`.
 */
export function toKebabCase(key: string): string {
    return key.replace(/(?<lower>[a-z0-9])(?<upper>[A-Z])/g, '$<lower>-$<upper>').toLowerCase();
}

/**
 * Convert a record key to CONSTANT_CASE for env injection: insert `_` at
 * camelCase boundaries, map any remaining non-alphanumeric run to `_`, then
 * uppercase. `analyticsDb` → `ANALYTICS_DB`, `db-main` → `DB_MAIN`, `db` → `DB`.
 */
export function toConstantCase(key: string): string {
    return key
        .replace(/(?<lower>[a-z0-9])(?<upper>[A-Z])/g, '$<lower>_$<upper>')
        .replace(/[^A-Za-z0-9]/g, '_')
        .toUpperCase();
}

/**
 * Resolve the compose service a record key binds to (CONVENTIONS A6).
 *
 * Order:
 *   1. An explicit `composeService` (`explicitComposeName`) always wins — the
 *      escape hatch for non-derivable names.
 *   2. Otherwise the key binds to the compose service named exactly like it,
 *      else to the kebab-case conversion of the key.
 *   3. If BOTH the exact key and its kebab-case form name a service in the
 *      compose file, the binding is ambiguous → throw (Lint runtime).
 *   4. If neither is present, fall back to the key itself (single-word keys and
 *      runs without a compose file stay unchanged).
 */
export function resolveComposeBinding(
    key: string,
    explicitComposeName: null | string,
    serviceNames: readonly string[],
): string {
    if (explicitComposeName !== null) {
        return explicitComposeName;
    }

    const kebab = toKebabCase(key);
    const exactExists = serviceNames.includes(key);
    const kebabExists = kebab !== key && serviceNames.includes(kebab);

    if (exactExists && kebabExists) {
        throw new Error(
            `Ambiguous compose binding for service key "${key}": the compose file declares ` +
                `both "${key}" and "${kebab}". Rename one service, or set ` +
                `composeService explicitly on the handle to pick the intended one.`,
        );
    }

    if (kebabExists) {
        return kebab;
    }
    return key;
}
