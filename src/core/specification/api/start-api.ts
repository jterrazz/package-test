import type { ContainerAccessor } from '../../../integrations/docker/container-accessor.js';
import { HonoAdapter } from '../../../integrations/hono/hono.adapter.js';
import { registerMatchers } from '../../../vitest/matchers.js';
import {
    type ApiSpecification,
    createApiFacet,
    type SpecificationConfig,
} from '../shared/builder.js';
import { getCallerDir } from '../shared/caller.js';
import { createDockerReader } from '../shared/docker-reader.js';
import { Orchestrator } from '../shared/orchestrator.js';
import { resolveRoot } from '../shared/resolve.js';
import {
    type DatabaseKeys,
    declaredDatabaseKeys,
    getWorkerId,
    releaseIsolation,
    type ServiceRecord,
    startServices,
} from '../shared/services.js';
import { FetchAdapter } from './fetch.adapter.js';

// ── Types ──

/** Any object with a request method compatible with Hono's app.request(). */
export type HonoApp = {
    request: (path: string, init?: RequestInit) => Promise<Response> | Response;
};

/** Execution mode — exists ONLY on `specification.api()` (CONVENTIONS A5). */
export type SpecificationMode = 'compose' | 'node';

/** Options for {@link startApi | specification.api}. */
export interface ApiSpecificationOptions<Services extends ServiceRecord = ServiceRecord> {
    /**
     * Execution mode override. Resolution: `options.mode` >
     * `process.env.TEST_MODE` > `'node'`. Never hardcode this in a
     * specification file when `server` is defined — set it per vitest
     * project via `env: { TEST_MODE: 'compose' }` (CONVENTIONS A5).
     */
    mode?: SpecificationMode;
    /**
     * Project root override for compose detection and init scripts. When
     * absent, the root is auto-discovered by walking up from the calling
     * specification file to the first directory containing
     * `docker/compose.test.yaml`, else the first containing `package.json`
     * (CONVENTIONS A9).
     */
    root?: string;
    /**
     * The app factory — receives the started services record (fully typed)
     * and returns the Hono app. Required in node mode, ignored in compose
     * mode (the app runs as a compose service there).
     */
    server?: (services: Services) => HonoApp;
    /**
     * Named infrastructure record. Keys become the `database` vocabulary of
     * `.seed()` / `.table()` and drive the compose binding: a handle with no
     * `composeService` option links to the compose service named exactly like
     * its key, else the kebab-case conversion of the key (CONVENTIONS A6).
     */
    services?: Services;
}

/**
 * The record returned by {@link startApi | specification.api}. Destructure
 * with the canonical names (CONVENTIONS A3):
 *
 *     const { api, cleanup, docker } = await specification.api(…);
 */
export interface ApiHandle<DatabaseKey extends string = string> {
    api: ApiSpecification<DatabaseKey>;
    /** Stop all infrastructure started by this specification. */
    cleanup: () => Promise<void>;
    /**
     * Read a running container by id — returns a {@link ContainerAccessor}
     * usable with `await expect(...).toBeRunning()` and read accessors.
     */
    docker: (containerId: string) => ContainerAccessor;
    /** The orchestrator managing the test infrastructure lifecycle. */
    orchestrator: Orchestrator;
}

// ── Mode resolution ──

function resolveMode(explicit: SpecificationMode | undefined): SpecificationMode {
    const value = explicit ?? process.env.TEST_MODE ?? 'node';
    if (value !== 'compose' && value !== 'node') {
        throw new Error(
            `Invalid test mode "${value}" — expected 'node' or 'compose' (options.mode or TEST_MODE).`,
        );
    }
    return value;
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
    const mode = resolveMode(options.mode);
    const services = (options.services ?? {}) as Services;
    const databaseKeys = declaredDatabaseKeys(services);

    if (mode === 'node') {
        if (!options.server) {
            throw new Error(
                "specification.api(): 'server' is required in node mode — provide " +
                    'server: (services) => app, or run in compose mode (TEST_MODE=compose).',
            );
        }

        const { database, databases, orchestrator } = await startServices(services, root);
        const app = options.server(services);

        const config: SpecificationConfig = {
            database,
            databaseKeys,
            databases,
            server: new HonoAdapter(app),
        };

        return {
            api: createApiFacet(config) as ApiSpecification<DatabaseKeys<Services>>,
            cleanup: async () => {
                await releaseIsolation(services);
                await orchestrator.stop();
            },
            docker: createDockerReader(callerDir),
            orchestrator,
        };
    }

    // Compose mode — docker compose up, real HTTP against the app service.
    const workerId = getWorkerId();
    const orchestrator = new Orchestrator({
        mode: 'e2e',
        projectName: `test-worker-${workerId}`,
        root,
        services,
    });

    await orchestrator.startCompose();

    const appUrl = orchestrator.getAppUrl();
    if (!appUrl) {
        throw new Error(
            'specification.api(): could not detect app URL from compose. Ensure an app service with ports is defined.',
        );
    }

    const databases = orchestrator.getDatabases();
    const config: SpecificationConfig = {
        database: orchestrator.getDatabase() ?? undefined,
        databaseKeys,
        databases: databases.size > 0 ? databases : undefined,
        // The app runs in its own container — MSW cannot reach it (I3).
        interceptDisabledReason:
            'intercepts are in-process (MSW) and not available in compose mode — ' +
            'keep intercept specs in node-only vitest projects.',
        server: new FetchAdapter(appUrl),
    };

    return {
        api: createApiFacet(config) as ApiSpecification<DatabaseKeys<Services>>,
        cleanup: () => orchestrator.stopCompose(),
        docker: createDockerReader(callerDir),
        orchestrator,
    };
}
