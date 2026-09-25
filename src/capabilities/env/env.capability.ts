import { defineCapability } from '../../model/chain/capability.js';
import type { SpecificationConfig } from '../../model/chain/config.js';
import type { CliEnv } from '../../model/ports/cli.port.js';
import type { ServiceHandle } from '../../model/ports/service.port.js';
import { toConstantCase } from '../../model/services/binding.js';

/** `.env(record)`, handing back the chain it was called on. */
export type EnvMethod<Self> = (env: CliEnv) => Self;

/**
 * `.env(record)`: the variables every child of the chain starts with, on top
 * of `process.env` — `null` unsets one, `$WORKDIR` expands to the working
 * directory in its resolved form. Chained calls merge, a later one winning.
 * Read by the actions that start a child; there is nothing to arm.
 */
export const env = defineCapability<'env', CliEnv, [env: CliEnv], Record<never, never>, 'env'>({
    context: 'env',
    initial: {},
    name: 'env',
    phase: 0,
    reduce: (merged, [added]) => ({ ...merged, ...added }),
    row: { group: 'Setup', name: '.env()', probe: '.env(' },
});

/**
 * Expand the `$WORKDIR` token in every string value of a child environment —
 * the one place the token is spelled out, for both doors (`.env()` on the
 * chain, `env:` in a `<case>.spec.yaml`).
 *
 * `workdir` is the RESOLVED directory (its realpath), never the raw temp
 * path: a value the child receives comes back in its output, and it must come
 * back spelled the way `{{workdir}}` holds it (CONVENTIONS D4). Expanding the
 * raw path made `HOME=$WORKDIR` on macOS echo `/var/folders/…` against a
 * `{{workdir}}` holding `/private/var/folders/…` — a golden no run could match.
 */
export function expandWorkdir(env: CliEnv, workdir: string): CliEnv {
    const expanded: CliEnv = {};
    for (const [key, value] of Object.entries(env)) {
        expanded[key] = typeof value === 'string' ? value.replaceAll('$WORKDIR', workdir) : value;
    }
    return expanded;
}

/**
 * The connection URLs a child is handed for the declared services
 * (CONVENTIONS B6): `<KEY>_URL` for each, plus `DATABASE_URL` when exactly
 * one of them is a SQL database and `REDIS_URL` when exactly one is a redis.
 */
function serviceEnv(services: Readonly<Record<string, ServiceHandle>> | undefined): CliEnv {
    const injected: CliEnv = {};
    const sql: ServiceHandle[] = [];
    const redis: ServiceHandle[] = [];
    for (const [key, handle] of Object.entries(services ?? {})) {
        injected[`${toConstantCase(key)}_URL`] = handle.connectionString;
        if (handle.createDatabaseAdapter() !== null) {
            sql.push(handle);
        }
        if (handle.type === 'redis') {
            redis.push(handle);
        }
    }
    const [onlySql] = sql;
    if (sql.length === 1 && onlySql !== undefined) {
        injected.DATABASE_URL = onlySql.connectionString;
    }
    const [onlyRedis] = redis;
    if (redis.length === 1 && onlyRedis !== undefined) {
        injected.REDIS_URL = onlyRedis.connectionString;
    }
    return injected;
}

/**
 * The environment a child of the chain starts with, in merge order: the
 * constructor's `defaults`, the declared services' URLs, the docker run id,
 * then the chain's own `.env()` — which always wins, `null` unsetting.
 * `undefined` when nothing at all is set, so the child inherits as it is.
 * `workdir` is the child's directory in its resolved form, as
 * {@link expandWorkdir} writes it.
 */
export function childEnv(
    config: SpecificationConfig,
    chained: CliEnv,
    workdir: string,
): CliEnv | undefined {
    const declared = config.defaultEnv;
    const services =
        config.services === undefined || Object.keys(config.services).length === 0
            ? undefined
            : serviceEnv(config.services);
    let merged: CliEnv | undefined = declared
        ? { ...expandWorkdir(declared, workdir), ...services }
        : services;
    const { dockerConfig, dockerTestRunId } = config;
    if (dockerConfig && dockerTestRunId !== undefined && dockerTestRunId !== '') {
        merged = { ...merged, [dockerConfig.envVar]: dockerTestRunId };
    }
    if (Object.keys(chained).length > 0) {
        merged = { ...merged, ...expandWorkdir(chained, workdir) };
    }
    return merged;
}
