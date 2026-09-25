import type { ChainConfig } from '../../kernel/chain/config.js';
import type { DatabasePort } from './database.port.js';
import type { ServiceHandle } from './service.port.js';

/**
 * Infrastructure services declared as a named record. Keys become the typed
 * vocabulary of the whole spec: the server factory receives the same record,
 * and `.seed()` / `.table()` target databases by key.
 */
export type ServiceRecord = Record<string, ServiceHandle>;

/** Keys of a services record whose handles are databases. */
export type DatabaseKeys<Services extends ServiceRecord> = {
    [K in keyof Services]: Services[K] extends DatabasePort ? K & string : never;
}[keyof Services];

/**
 * The keys of a services record whose handles are databases, in the order
 * the record declares them — the runtime twin of {@link DatabaseKeys}, and
 * what `ServicesConfig.databaseKeys` holds.
 */
export function declaredDatabaseKeys(services: ServiceRecord): string[] {
    return Object.entries(services)
        .filter(([, service]) => service.createDatabaseAdapter() !== null)
        .map(([key]) => key);
}

/** What a constructor that starts a services record hands its chain. */
export type ServicesConfig = ChainConfig & {
    database?: DatabasePort | undefined;
    /**
     * Keys of the declared services record that are databases. Drives the
     * CONVENTIONS A7 rule: with 2+ databases the `database` option is
     * mandatory on `.seed()` / `.table()`; with exactly one it is forbidden.
     */
    databaseKeys?: string[] | undefined;
    databases?: Map<string, DatabasePort> | undefined;
    /**
     * The declared services record. In cli mode, drives the automatic
     * connection-URL injection into the child env (CONVENTIONS B6):
     * `<KEY>_URL` per service, plus `DATABASE_URL` / `REDIS_URL` when
     * unambiguous.
     */
    services?: Record<string, ServiceHandle> | undefined;
};
