/** `analyticsDb` gives `analytics-db`. */
export function toKebabCase(key: string): string {
    return key.replaceAll(/(?<lower>[a-z0-9])(?<upper>[A-Z])/gu, '$<lower>-$<upper>').toLowerCase();
}

/** `analyticsDb` gives `ANALYTICS_DB`, `db-main` gives `DB_MAIN`. */
export function toConstantCase(key: string): string {
    return key
        .replaceAll(/(?<lower>[a-z0-9])(?<upper>[A-Z])/gu, '$<lower>_$<upper>')
        .replaceAll(/[^A-Za-z0-9]/gu, '_')
        .toUpperCase();
}
