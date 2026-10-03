import { resolveRoot } from '../../../lint/kit/project/resolve.js';
import type { Started } from '../../chain/config.js';
import { getCallerDir } from '../../chain/paths/caller.js';
import { createDockerReader } from '../../expectations/command/container.js';
import type { ContainerAccessor } from '../../expectations/command/container.js';
import { registerMatchers } from '../../expectations/goldens/matchers.js';
import { declaredDatabaseKeys } from '../../services/services.js';
import type { DatabaseKeys, ServiceRecord, ServicesConfig } from '../../services/services.js';
import { releaseIsolation, startServices } from '../../services/startup/start-services.js';
import type { ApiSpecification } from './api.facet.js';
import { apiFacet } from './api.facet.js';
import { routesLedger, writeLedger } from './routes/ledger.js';
import { HonoAdapter } from './server/hono.adapter.js';
import type { HonoApp } from './server/hono.adapter.js';
import type { ServerPort } from './server/server.port.js';

export type ApiConfig = ServicesConfig & { server?: ServerPort | undefined };

/** Options for {@link startApi | specification.api}. */
export type ApiSpecificationOptions<Services extends ServiceRecord = ServiceRecord> = {
    /** Project root override; by default the nearest `package.json` above the specification file (`no-redundant-root`). */
    root?: string;
    /** The app factory: receives the started services record, returns the Hono app. */
    server: (services: Services) => HonoApp;
    /** Named infrastructure record: the keys are the `database` vocabulary, and name the init-script folder. */
    services?: Services;
};

/** What `specification.api()` returns: `const { api, cleanup, docker } = …` (`no-runner-alias`). */
export type ApiHandle<DatabaseKey extends string = string> = {
    api: ApiSpecification<DatabaseKey>;
    /** Stop all infrastructure started by this specification. */
    cleanup: () => Promise<void>;
    /** Read a running container by id. */
    docker: (containerId: string) => ContainerAccessor;
};

export async function startApi<Services extends ServiceRecord>(
    options: ApiSpecificationOptions<Services>,
): Promise<ApiHandle<DatabaseKeys<Services>>> {
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
