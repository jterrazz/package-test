import { dirname } from 'node:path';

import type { DatabasePort } from '../adapters/ports/database.port.js';
import { postgres } from '../adapters/postgres.adapter.js';
import { redis } from '../adapters/redis.adapter.js';
import {
    type AppInfo,
    formatStartupReport,
    type ServiceReport,
} from '../builder/common/reporter.js';
import { ComposeStackAdapter } from './adapters/compose.adapter.js';
import { TestcontainersAdapter } from './adapters/testcontainers.adapter.js';
import { detectServiceType, findComposeFile, parseComposeFile } from './compose-parser.js';
import type { ContainerPort } from './ports/container.port.js';
import type { ServiceHandle } from './ports/service.port.js';

interface RunningService {
    handle: ServiceHandle;
    container: ContainerPort | null;
}

export interface OrchestratorOptions {
    services: ServiceHandle[];
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
    private services: ServiceHandle[];
    private mode: 'e2e' | 'integration';
    private root: string;
    private projectName: string | undefined;
    private running: RunningService[] = [];
    private composeStack: ComposeStackAdapter | null = null;
    private composeHandles: ServiceHandle[] = [];
    private started = false;

    constructor(options: OrchestratorOptions) {
        this.services = options.services;
        this.mode = options.mode;
        this.root = options.root ?? process.cwd();
        this.projectName = options.projectName;
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
        const composeConfig = composePath ? parseComposeFile(composePath) : null;

        // Separate services that need containers from embedded ones (e.g. SQLite)
        const containerServices: { container: TestcontainersAdapter; handle: ServiceHandle }[] = [];
        const embeddedServices: ServiceHandle[] = [];

        for (const handle of this.services) {
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

            const container = new TestcontainersAdapter({ image, port: handle.defaultPort, env });
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
        const composeConfig = parseComposeFile(composePath);

        this.composeStack = new ComposeStackAdapter(composePath, this.projectName);
        await this.composeStack.start();

        // Create handles for detected infra services
        for (const service of composeConfig.infraServices) {
            const type = detectServiceType(service.image);

            if (type === 'postgres') {
                const handle = postgres({ compose: service.name, env: service.environment });
                const port = this.composeStack.getMappedPort(service.name, 5432);
                handle.connectionString = handle.buildConnectionString('localhost', port);

                await handle.initialize(composeDir);
                handle.started = true;

                this.composeHandles.push(handle);
            } else if (type === 'redis') {
                const handle = redis({ compose: service.name });
                const port = this.composeStack.getMappedPort(service.name, 6379);
                handle.connectionString = handle.buildConnectionString('localhost', port);
                handle.started = true;

                this.composeHandles.push(handle);
            }
        }

        const durationMs = Date.now() - startTime;
        const reports: ServiceReport[] = this.composeHandles.map((h) => ({
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
     * Get a database service by compose name, or the first one if no name given.
     */
    getDatabase(serviceName?: string): DatabasePort | null {
        for (const handle of [...this.services, ...this.composeHandles]) {
            if (serviceName && handle.composeName !== serviceName) {
                continue;
            }
            const adapter = handle.createDatabaseAdapter();
            if (adapter) {
                return adapter;
            }
        }
        return null;
    }

    /**
     * Get all database services keyed by compose name.
     */
    getDatabases(): Map<string, DatabasePort> {
        const map = new Map<string, DatabasePort>();
        for (const handle of [...this.services, ...this.composeHandles]) {
            const adapter = handle.createDatabaseAdapter();
            if (adapter && handle.composeName) {
                map.set(handle.composeName, adapter);
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

        const config = parseComposeFile(composePath);
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
