import type { SpecificationConfig } from '../../model/chain/builder.js';
import { getCallerDir } from '../../model/chain/caller.js';
import { createDockerReader } from '../../model/chain/docker-reader.js';
import { resolveRoot } from '../../model/chain/resolve.js';
import {
    declaredDatabaseKeys,
    releaseIsolation,
    startServices,
} from '../../model/chain/services.js';
import type { DatabaseKeys, ServiceRecord } from '../../model/chain/services.js';
import { registerMatchers } from '../../model/goldens/matchers.js';
import { writeLedger } from '../../model/routes/routes.js';
import type { ContainerAccessor } from '../../seams/docker/container-accessor.js';
import { HonoAdapter } from '../../seams/hono/hono.adapter.js';
import { createApiFacet } from './api.chain.js';
import type { ApiSpecification } from './api.chain.js';

// ── Types ──

/** Any object with a request method compatible with Hono's app.request(). */
export type HonoApp = {
    request: (path: string, init?: RequestInit) => Promise<Response> | Response;
    /** The route table a Hono app carries — what route coverage measures the run against. */
    routes?: readonly { method: string; path: string }[];
};

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

/**
 * Where the run collects route ledgers — what the api project's global setup
 * provides; `undefined` for a run that measures no route coverage.
 */
async function routesLedger(): Promise<string | undefined> {
    try {
        const { inject } = await import('vitest');
        return inject('routesLedger');
    } catch {
        return undefined;
    }
}

// ── Constructor ──

export async function startApi<Services extends ServiceRecord>(
    options: ApiSpecificationOptions<Services>,
): Promise<ApiHandle<DatabaseKeys<Services>>> {
    // Caller detection must run before any await — async resumption drops
    // The calling file's frames from the stack.
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

    const config: SpecificationConfig = {
        database,
        databaseKeys,
        databases,
        server,
    };

    return {
        api: createApiFacet(config),
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
