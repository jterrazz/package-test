import { toConstantCase } from '../../../../lint/kit/project/record-key.js';
import { defineCapability } from '../../../chain/capability.js';
import type { ChainSignature } from '../../../chain/capability.js';
import type { ServiceHandle } from '../../../services/service.port.js';
import type { CliConfig } from '../cli.handle.js';
import type { CliEnv } from './cli.port.js';

export type EnvMethod<Self> = (env: CliEnv) => Self;

export type EnvChain<Self> = {
    /** Set environment variables on the child process. `$WORKDIR` expands; `null` unsets. */
    env: EnvMethod<Self>;
};

export interface EnvSignature extends ChainSignature {
    readonly chain: EnvChain<this['self']>;
}

/** Chained calls merge, a later one winning; nothing to arm. */
export const env = defineCapability<
    'env',
    CliEnv,
    [env: CliEnv],
    EnvSignature,
    Record<never, never>,
    'env'
>({
    context: 'env',
    initial: {},
    name: 'env',
    phase: 0,
    reduce: (merged, [added]) => ({ ...merged, ...added }),
    row: { group: 'Setup', name: '.env()', probe: '.env(' },
});

/** The resolved directory, never the raw temp path: on macOS `/var/folders/...` would never match `{{workdir}}`'s `/private/var/folders/...`. */
export function expandWorkdir(variables: CliEnv, workdir: string): CliEnv {
    const expanded: CliEnv = {};
    for (const [key, value] of Object.entries(variables)) {
        expanded[key] = typeof value === 'string' ? value.replaceAll('$WORKDIR', workdir) : value;
    }
    return expanded;
}

function onlyOf(handles: ServiceHandle[]): ServiceHandle | undefined {
    const [only, ...others] = handles;
    return others.length === 0 ? only : undefined;
}

// invariant: `service-urls-injected`: `<KEY>_URL` each, `DATABASE_URL` / `REDIS_URL` when exactly one of that kind.
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
    const onlySql = onlyOf(sql);
    if (onlySql !== undefined) {
        injected.DATABASE_URL = onlySql.connectionString;
    }
    const onlyRedis = onlyOf(redis);
    if (onlyRedis !== undefined) {
        injected.REDIS_URL = onlyRedis.connectionString;
    }
    return injected;
}

/** Merge order: `defaults`, services' URLs, docker run id, then the chain's `.env()`; `undefined` when nothing is set. */
export function childEnv(config: CliConfig, chained: CliEnv, workdir: string): CliEnv | undefined {
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
