import { resolve } from 'node:path';

import type { ContainerPort } from '../../ports/container.port.js';
import type { DatabasePort } from '../../ports/database.port.js';
import type { ServiceHandle } from '../../ports/service.port.js';
import { toKebabCase } from './binding.js';
import { getContainerIntegrations } from './registry.js';
import { formatStartupReport } from './reporter.js';
import type { AppInfo, ServiceReport } from './reporter.js';

type RunningService = {
    handle: ServiceHandle;
    container: ContainerPort | null;
};

export type OrchestratorOptions = {
    /**
     * Named infrastructure record. Keys are the database vocabulary of the spec
     * (`.seed()` / `.table()` `database` option) and the name each handle is
     * reported and initialised under: the kebab-case form of the key is the
     * directory its init script lives in (`analyticsDb` → `docker/analytics-db/`).
     */
    services: Record<string, ServiceHandle>;
    /**
     * The project root, already resolved. REQUIRED: the constructors derive it
     * by walking up from the calling specification file (CONVENTIONS A9), and
     * the orchestrator is handed the answer. Defaulting to `process.cwd()` here
     * meant one silent second opinion about what the project is — the runner
     * resolving from the caller, this from wherever the runner happened to be
     * launched, which in a workspace is rarely the same directory.
     */
    root: string;
};

/** Where a service reads its init script from — `<root>/docker/<service>/`. */
const DOCKER_DIR = 'docker';

/**
 * The infrastructure a specification declares, started and stopped as a unit.
 *
 * Every declared handle becomes a real thing: a container through
 * testcontainers, or an embedded service (SQLite) that needs no container. The
 * record KEY is the only name in play — it is the spec's database vocabulary,
 * the name the startup report prints, and, kebab-cased, the directory the
 * service reads its init script from.
 *
 * It is internal wiring: the constructors drive it, and no consumer names it.
 */
export class Orchestrator {
    private readonly services: Record<string, ServiceHandle>;
    private readonly root: string;
    private running: RunningService[] = [];
    private started = false;

    constructor(options: OrchestratorOptions) {
        this.services = options.services;
        this.root = options.root;
    }

    /**
     * Start every declared service.
     * Phase 1: start all containers in parallel (the slow part).
     * Phase 2: wire connections, healthcheck, and init sequentially (fast).
     */
    async start(): Promise<void> {
        if (this.started) {
            return;
        }

        const dockerDir = resolve(this.root, DOCKER_DIR);
        for (const [key, handle] of Object.entries(this.services)) {
            handle.serviceName = toKebabCase(key);
        }

        // Separate services that need containers from embedded ones (e.g. SQLite)
        const containerServices: { container: ContainerPort; handle: ServiceHandle }[] = [];
        const embeddedServices: ServiceHandle[] = [];

        for (const handle of Object.values(this.services)) {
            if (handle.defaultPort === 0) {
                // Embedded service (no container needed)
                embeddedServices.push(handle);
                continue;
            }

            const container = getContainerIntegrations().createContainer({
                image: handle.defaultImage,
                port: handle.defaultPort,
                env: { ...handle.environment },
            });
            containerServices.push({ container, handle });
        }

        // Phase 1: start containers in parallel + initialize embedded services
        await Promise.all([
            ...containerServices.map(async ({ container }) => {
                await container.start();
            }),
            ...embeddedServices.map(async (handle) => {
                await handle.initialize(dockerDir, this.root);
                handle.started = true;
                this.running.push({ handle, container: null });
            }),
        ]);

        // Phase 2: wire connections, healthcheck, init (fast — containers already running)
        const reports: ServiceReport[] = [];

        for (const { container, handle } of containerServices) {
            const serviceStartTime = Date.now();

            try {
                const host = container.getHost();
                const port = container.getMappedPort(handle.defaultPort);
                handle.connectionString = handle.buildConnectionString(host, port);

                await handle.healthcheck();
                await handle.initialize(dockerDir, this.root);
                handle.started = true;

                reports.push({
                    name: handle.serviceName ?? handle.type,
                    type: handle.type,
                    connectionString: handle.connectionString,
                    durationMs: Date.now() - serviceStartTime,
                });
                this.running.push({ handle, container });
            } catch (error: any) {
                let logs = '';
                try {
                    logs = await container.getLogs();
                } catch {
                    /* Ignore log fetch errors */
                }
                try {
                    await container.stop();
                } catch {
                    /* Ignore stop errors */
                }

                reports.push({
                    name: handle.serviceName ?? handle.type,
                    type: handle.type,
                    durationMs: Date.now() - serviceStartTime,
                    error: error.message,
                    logs,
                });

                const output = formatStartupReport(reports, { type: 'in-process' });
                console.error(output);
                throw error;
            }
        }

        this.started = true;

        const appInfo: AppInfo = { type: 'in-process' };
        const output = formatStartupReport(reports, appInfo);
        console.log(output);
    }

    /** Stop every container this stack started. */
    async stop(): Promise<void> {
        for (const { container } of this.running) {
            if (container) {
                await container.stop();
            }
        }
        this.running = [];
        this.started = false;
    }

    /** The default database — the first declared handle that is one. */
    getDatabase(): DatabasePort | null {
        for (const handle of Object.values(this.services)) {
            const adapter = handle.createDatabaseAdapter();
            if (adapter) {
                return adapter;
            }
        }
        return null;
    }

    /** Every database service, keyed by its record key. */
    getDatabases(): Map<string, DatabasePort> {
        const map = new Map<string, DatabasePort>();
        for (const [key, handle] of Object.entries(this.services)) {
            const adapter = handle.createDatabaseAdapter();
            if (adapter) {
                map.set(key, adapter);
            }
        }
        return map;
    }
}
