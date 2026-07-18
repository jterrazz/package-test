import { dirname } from 'node:path';

import type { ContainerPort } from '../../ports/container.port.js';
import type { DatabasePort } from '../../ports/database.port.js';
import type { ServiceHandle } from '../../ports/service.port.js';
import { resolveComposeBinding } from './binding.js';
import { type ComposeConfig, detectServiceType, findComposeFile } from './compose-file.js';
import {
    type ComposeStackPort,
    getComposeServiceFactory,
    getContainerIntegrations,
} from './registry.js';
import { type AppInfo, formatStartupReport, type ServiceReport } from './reporter.js';

interface RunningService {
    handle: ServiceHandle;
    container: ContainerPort | null;
}

export interface OrchestratorOptions {
    /**
     * Named infrastructure record. Keys become the database vocabulary of the
     * spec (`.seed()` / `.table()` `database` option) and drive the compose
     * binding: a handle with no explicit `composeService` links to the compose
     * service named exactly like its key, else the kebab-case conversion of the
     * key (`analyticsDb` → `analytics-db`) — see {@link resolveComposeBinding}.
     */
    services: Record<string, ServiceHandle>;
    mode: 'e2e' | 'integration';
    root?: string;
    /** Compose project name — used for per-worker stack isolation. */
    projectName?: string;
}

/**
 * Orchestrator for test infrastructure.
 * Integration: starts services via testcontainers.
 * E2E: runs full docker compose up.
 */
export class Orchestrator {
    private services: Record<string, ServiceHandle>;
    private mode: 'e2e' | 'integration';
    private root: string;
    private projectName: string | undefined;
    private running: RunningService[] = [];
    private composeStack: ComposeStackPort | null = null;
    private composeHandles: ServiceHandle[] = [];
    private started = false;

    constructor(options: OrchestratorOptions) {
        this.services = options.services;
        this.mode = options.mode;
        this.root = options.root ?? process.cwd();
        this.projectName = options.projectName;
    }

    /**
     * Bind each declared handle to a compose service (CONVENTIONS A6): a record
     * key resolves to the service named exactly like it, else the kebab-case
     * conversion of the key; an explicit `composeService` wins. Throws on an
     * ambiguous binding (both names present). Runs once compose config is known
     * so the two-step resolution can consult the real service list.
     */
    private resolveBindings(composeConfig: ComposeConfig | null): void {
        const serviceNames = composeConfig?.services.map((s) => s.name) ?? [];
        for (const [key, handle] of Object.entries(this.services)) {
            handle.composeName = resolveComposeBinding(key, handle.composeName, serviceNames);
        }
    }

    /**
     * Start declared services via testcontainers (integration mode).
     * Phase 1: start all containers in parallel (the slow part).
     * Phase 2: wire connections, healthcheck, and init sequentially (fast).
     */
    async start(): Promise<void> {
        if (this.started) {
            return;
        }

        const composePath = findComposeFile(this.root);
        const composeDir = composePath ? dirname(composePath) : this.root;
        const composeConfig = composePath
            ? getContainerIntegrations().parseComposeFile(composePath)
            : null;

        this.resolveBindings(composeConfig);

        // Separate services that need containers from embedded ones (e.g. SQLite)
        const containerServices: { container: ContainerPort; handle: ServiceHandle }[] = [];
        const embeddedServices: ServiceHandle[] = [];

        for (const handle of Object.values(this.services)) {
            if (handle.defaultPort === 0) {
                // Embedded service (no container needed)
                embeddedServices.push(handle);
                continue;
            }

            let image = handle.defaultImage;
            let env = { ...handle.environment };

            if (handle.composeName && composeConfig) {
                const composeService = composeConfig.services.find(
                    (s) => s.name === handle.composeName,
                );
                if (composeService) {
                    image = composeService.image ?? image;
                    env = { ...env, ...composeService.environment };
                    Object.assign(handle.environment, composeService.environment);
                }
            }

            const container = getContainerIntegrations().createContainer({
                image,
                port: handle.defaultPort,
                env,
            });
            containerServices.push({ container, handle });
        }

        // Phase 1: start containers in parallel + initialize embedded services
        await Promise.all([
            ...containerServices.map(({ container }) => container.start()),
            ...embeddedServices.map(async (handle) => {
                await handle.initialize(composeDir);
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
                await handle.initialize(composeDir);
                handle.started = true;

                reports.push({
                    name: handle.composeName ?? handle.type,
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
                    name: handle.composeName ?? handle.type,
                    type: handle.type,
                    durationMs: Date.now() - serviceStartTime,
                    error: error.message,
                    logs,
                });

                const output = formatStartupReport('integration', reports, { type: 'in-process' });
                console.error(output);
                throw error;
            }
        }

        this.started = true;

        const appInfo: AppInfo = { type: 'in-process' };
        const output = formatStartupReport('integration', reports, appInfo);
        console.log(output);
    }

    /**
     * Stop testcontainers (integration mode).
     */
    async stop(): Promise<void> {
        for (const { container } of this.running) {
            if (container) {
                await container.stop();
            }
        }
        this.running = [];
        this.started = false;
    }

    /**
     * Start full docker compose stack (e2e mode).
     * Auto-detects infra services and creates handles for them.
     */
    async startCompose(): Promise<void> {
        const composePath = findComposeFile(this.root);
        if (!composePath) {
            throw new Error(`E2E: no compose file found in ${this.root}`);
        }

        const startTime = Date.now();
        const composeDir = dirname(composePath);
        const composeConfig = getContainerIntegrations().parseComposeFile(composePath);

        this.resolveBindings(composeConfig);

        this.composeStack = getContainerIntegrations().createComposeStack(
            composePath,
            this.projectName,
        );
        await this.composeStack.start();

        // Wire declared handles to their compose services first, so the
        // Services-record keys stay the database vocabulary in stack mode
        // (same tests run against app() and stack() targets).
        const declaredComposeNames = new Set<string>();
        for (const handle of Object.values(this.services)) {
            if (handle.defaultPort === 0) {
                // Embedded service (e.g. SQLite) — no compose container.
                await handle.initialize(composeDir);
                handle.started = true;
                continue;
            }

            const composeService = composeConfig.services.find(
                (s) => s.name === handle.composeName,
            );
            if (!composeService || !handle.composeName) {
                continue;
            }

            declaredComposeNames.add(handle.composeName);
            Object.assign(handle.environment, composeService.environment);

            const port = this.composeStack.getMappedPort(handle.composeName, handle.defaultPort);
            handle.connectionString = handle.buildConnectionString('localhost', port);

            await handle.healthcheck();
            await handle.initialize(composeDir);
            handle.started = true;
        }

        // Auto-detect the remaining infra services (not covered by a declared
        // Handle). The type -> handle factories are registered by the service
        // Integrations (postgres, redis) via the package entry point, so core
        // Never imports them (CONVENTIONS I1).
        for (const service of composeConfig.infraServices) {
            if (declaredComposeNames.has(service.name)) {
                continue;
            }

            const factory = getComposeServiceFactory(detectServiceType(service.image));
            if (!factory) {
                continue;
            }

            const handle = factory(service);
            const port = this.composeStack.getMappedPort(service.name, handle.defaultPort);
            handle.connectionString = handle.buildConnectionString('localhost', port);

            await handle.initialize(composeDir);
            handle.started = true;

            this.composeHandles.push(handle);
        }

        const durationMs = Date.now() - startTime;
        const reports: ServiceReport[] = [...this.allHandles().values()]
            .filter((h) => h.started)
            .map((h) => ({
                name: h.composeName ?? h.type,
                type: h.type,
                connectionString: h.connectionString,
                durationMs,
            }));

        const appUrl = this.getAppUrl();
        const appInfo: AppInfo = { type: 'http', url: appUrl ?? undefined };
        const output = formatStartupReport('e2e', reports, appInfo);
        console.log(output);
    }

    /**
     * Stop docker compose stack (e2e mode).
     */
    async stopCompose(): Promise<void> {
        if (this.composeStack) {
            await this.composeStack.stop();
            this.composeStack = null;
        }
        this.composeHandles = [];
    }

    /**
     * Get the default database — the first declared handle that is one.
     */
    getDatabase(): DatabasePort | null {
        for (const handle of this.allHandles().values()) {
            const adapter = handle.createDatabaseAdapter();
            if (adapter) {
                return adapter;
            }
        }
        return null;
    }

    /**
     * Get all database services keyed by their record key (declared services)
     * or compose service name (stack-detected services).
     */
    getDatabases(): Map<string, DatabasePort> {
        const map = new Map<string, DatabasePort>();
        for (const [key, handle] of this.allHandles()) {
            const adapter = handle.createDatabaseAdapter();
            if (adapter) {
                map.set(key, adapter);
            }
        }
        return map;
    }

    private allHandles(): Map<string, ServiceHandle> {
        const map = new Map<string, ServiceHandle>(Object.entries(this.services));
        for (const handle of this.composeHandles) {
            const key = handle.composeName ?? handle.type;
            if (!map.has(key)) {
                map.set(key, handle);
            }
        }
        return map;
    }

    /**
     * Get app URL from compose (e2e mode).
     */
    getAppUrl(): null | string {
        const composePath = findComposeFile(this.root);
        if (!composePath || !this.composeStack) {
            return null;
        }

        const config = getContainerIntegrations().parseComposeFile(composePath);
        const appService = config.appService;

        if (!appService || appService.ports.length === 0) {
            return null;
        }

        const port = this.composeStack.getMappedPort(
            appService.name,
            appService.ports[0].container,
        );
        return `http://localhost:${port}`;
    }
}
