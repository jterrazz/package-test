import type { ChainConfig } from '../chain/config.js';
import type { DatabasePort } from './database.port.js';
import type { ServiceHandle } from './service.port.js';

/** Services declared as a named record: the keys are the spec's database vocabulary. */
export type ServiceRecord = Record<string, ServiceHandle>;

/** Keys of a services record whose handles are databases. */
export type DatabaseKeys<Services extends ServiceRecord> = {
    [K in keyof Services]: Services[K] extends DatabasePort ? K & string : never;
}[keyof Services];

export function declaredDatabaseKeys(services: ServiceRecord): string[] {
    return Object.entries(services)
        .filter(([, service]) => service.createDatabaseAdapter() !== null)
        .map(([key]) => key);
}

export type ServicesConfig = ChainConfig & {
    database?: DatabasePort | undefined;
    /** Drives `database-named-only-when-several-at-runtime`: with 2+ databases `database` is required on `.seed()` / `.table()`, with one it is refused. */
    databaseKeys?: string[] | undefined;
    databases?: Map<string, DatabasePort> | undefined;
    /** In cli mode, drives the `<KEY>_URL` injection (`service-urls-injected`), plus `DATABASE_URL` / `REDIS_URL` when unambiguous. */
    services?: Record<string, ServiceHandle> | undefined;
};
