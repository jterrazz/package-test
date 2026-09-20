import type { ContainerAccessor } from '../../../integrations/docker/container-accessor.js';
import { HonoAdapter } from '../../../integrations/hono/hono.adapter.js';
import { registerMatchers } from '../../../vitest/matchers.js';
import { createApiFacet } from '../_common/builder.js';
import type { ApiSpecification, SpecificationConfig } from '../_common/builder.js';
import { getCallerDir } from '../_common/caller.js';
import { createDockerReader } from '../_common/docker-reader.js';
import { resolveRoot } from '../_common/resolve.js';
import { declaredDatabaseKeys, releaseIsolation, startServices } from '../_common/services.js';
import type { DatabaseKeys, ServiceRecord } from '../_common/services.js';

// ── Types ──

/** Any object with a request method compatible with Hono's app.request(). */
export type HonoApp = {
    request: (path: string, init?: RequestInit) => Promise<Response> | Response;
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

    const config: SpecificationConfig = {
        database,
        databaseKeys,
        databases,
        server: new HonoAdapter(app),
    };

    return {
        api: createApiFacet(config),
        cleanup: async () => {
            await stopProcesses();
            await releaseIsolation(services);
            await orchestrator.stop();
        },
        docker: createDockerReader(callerDir),
    };
}
