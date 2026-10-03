import { resolve } from 'node:path';

import { toKebabCase } from '../../../lint/kit/project/record-key.js';
import type { ContainerPort } from '../containers/container.port.js';
import type { DatabasePort } from '../database.port.js';
import type { ServiceHandle } from '../service.port.js';
import { getContainerIntegrations } from './registry.js';
import { formatStartupReport } from './startup-report.js';
import type { AppInfo, ServiceReport } from './startup-report.js';

type RunningService = {
    handle: ServiceHandle;
    container: ContainerPort | null;
};

export type OrchestratorOptions = {
    /** Defaults to the api shape; a subject that is no app says `{ type: 'none' }` and gets no line. */
    subject?: AppInfo | undefined;
    /** The kebab-case key names the init-script folder: `analyticsDb` → `docker/analytics-db/`. */
    services: Record<string, ServiceHandle>;
    /** Required: resolved from the calling specification file (`no-redundant-root`), never from `process.cwd()`. */
    root: string;
};

const DOCKER_DIR = 'docker';

/** How far before a start its failure report reads logs, for a runtime clock behind the host's. */
const LOG_CLOCK_MARGIN_MS = 500;

export class Orchestrator {
    private readonly services: Record<string, ServiceHandle>;
    private readonly root: string;
    private readonly subject: AppInfo;
    private running: RunningService[] = [];
    private started = false;

    constructor(options: OrchestratorOptions) {
        this.services = options.services;
        this.root = options.root;
        this.subject = options.subject ?? { type: 'in-process' };
    }

    /** Containers start in parallel (the slow part), then connections, healthchecks and inits run in order. */
    async start(): Promise<void> {
        if (this.started) {
            return;
        }

        const dockerDir = resolve(this.root, DOCKER_DIR);
        for (const [key, handle] of Object.entries(this.services)) {
            handle.serviceName = toKebabCase(key);
        }

        const containerServices: { container: ContainerPort; handle: ServiceHandle }[] = [];
        const embeddedServices: ServiceHandle[] = [];

        for (const handle of Object.values(this.services)) {
            if (handle.defaultPort === 0) {
                embeddedServices.push(handle);
                continue;
            }

            const container = getContainerIntegrations().createContainer({
                image: handle.defaultImage,
                port: handle.defaultPort,
                env: { ...handle.environment },
                ...handle.containerOptions,
            });
            containerServices.push({ container, handle });
        }

        const startedAt = Date.now();
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
                    // A container of the project logs every file's work: the report reads from this start's.
                    logs = await container.getLogs(new Date(startedAt - LOG_CLOCK_MARGIN_MS));
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

                const output = formatStartupReport(reports, this.subject);
                console.error(output);
                throw error;
            }
        }

        this.started = true;

        const output = formatStartupReport(reports, this.subject);
        console.log(output);
    }

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
