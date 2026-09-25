import { createDockerReader } from '../../expectations/command/container.js';
import type { ContainerAccessor } from '../../expectations/command/container.js';
import { registerMatchers } from '../../expectations/goldens/matchers.js';
import type { Started } from '../../kernel/chain/config.js';
import { getCallerDir } from '../../kernel/files/caller.js';
import { resolveRoot } from '../../kernel/files/resolve.js';
import { declaredDatabaseKeys } from '../../world/services/services.js';
import type { DatabaseKeys, ServiceRecord, ServicesConfig } from '../../world/services/services.js';
import { releaseIsolation, startServices } from '../../world/services/startup/start-services.js';
import type { ApiSpecification } from './api.facet.js';
import { apiFacet } from './api.facet.js';
import { routesLedger, writeLedger } from './routes/ledger.js';
import { HonoAdapter } from './server/hono.adapter.js';
import type { HonoApp } from './server/hono.adapter.js';
import type { ServerPort } from './server/server.port.js';

/** What `specification.api()` hands its chain: the services record, and the app a request is sent to. */
export type ApiConfig = ServicesConfig & { server?: ServerPort | undefined };

/** Options for {@link startApi | specification.api}. */
export type ApiSpecificationOptions<Services extends ServiceRecord = ServiceRecord> = {
    /**
     * Project root override for init scripts and artefact paths. When absent,
     * the root is auto-discovered by walking up from the calling specification
     * file to the first directory containing `package.json` (CONVENTIONS A9).
     */
    root?: string;
    /**
     * The app factory — receives the started services record (fully typed)
     * and returns the Hono app.
     */
    server: (services: Services) => HonoApp;
    /**
     * Named infrastructure record. Keys become the `database` vocabulary of
     * `.seed()` / `.table()`, and, kebab-cased, the folder each service reads
     * its init script from (`{ analyticsDb: postgres() }` →
     * `docker/analytics-db/init.sql`).
     */
    services?: Services;
};

/**
 * The record returned by {@link startApi | specification.api}. Destructure
 * with the canonical names (CONVENTIONS A3):
 *
 *     const { api, cleanup, docker } = await specification.api(…);
 */
export type ApiHandle<DatabaseKey extends string = string> = {
    api: ApiSpecification<DatabaseKey>;
    /** Stop all infrastructure started by this specification. */
    cleanup: () => Promise<void>;
    /**
     * Read a running container by id — returns a {@link ContainerAccessor}
     * usable with `await expect(...).toBeRunning()` and read accessors.
     */
    docker: (containerId: string) => ContainerAccessor;
};

export async function startApi<Services extends ServiceRecord>(
    options: ApiSpecificationOptions<Services>,
): Promise<ApiHandle<DatabaseKeys<Services>>> {
    // Caller detection must run before any await — async resumption drops
    // the calling file's frames from the stack.
    const callerDir = getCallerDir();
    await registerMatchers();
    const root = resolveRoot(options.root, callerDir);
    const services = (options.services ?? {}) as Services;
    const databaseKeys = declaredDatabaseKeys(services);

    const { database, databases, orchestrator, stopProcesses } = await startServices(
        services,
        root,
    );
    const app = options.server(services);
    const server = new HonoAdapter(app);

    const config: Started<ApiConfig, 'server'> = {
        database,
        databaseKeys,
        databases,
        server,
    };

    return {
        api: apiFacet.open(config),
        cleanup: async () => {
            const ledgers = await routesLedger();
            if (ledgers !== undefined) {
                writeLedger(ledgers, {
                    declared: server.declared(),
                    reached: server.reached,
                });
            }
            await stopProcesses();
            await releaseIsolation(services);
            await orchestrator.stop();
        },
        docker: createDockerReader(callerDir),
    };
}
