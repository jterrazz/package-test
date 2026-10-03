import { resolve } from 'node:path';

import { toKebabCase } from '../../../lint/kit/project/record-key.js';
import type { ContainerPort } from '../containers/container.port.js';
import type { DatabasePort } from '../database.port.js';
import type { ServiceHandle } from '../service.port.js';
import { getContainerIntegrations } from './registry.js';
import { formatStartupReport } from './startup-report.js';
import type { AppInfo, ServiceReport } from './startup-report.js';

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

function containerFor(handle: ServiceHandle): ContainerPort {
    return getContainerIntegrations().createContainer({
        image: handle.defaultImage,
        port: handle.defaultPort,
        env: { ...handle.environment },
        ...handle.containerOptions,
    });
}

/** The report of a container that failed to come up, with its logs since this start; the container is stopped. */
async function abandoned(failed: {
    container: ContainerPort;
    error: unknown;
    handle: ServiceHandle;
    logsSince: number;
    since: number;
}): Promise<ServiceReport> {
    const { container, error, handle } = failed;
    let logs = '';
    try {
        // invariant: a container of the project logs every file's work: the report reads from this start's.
        logs = await container.getLogs(new Date(failed.logsSince - LOG_CLOCK_MARGIN_MS));
    } catch {
        /* invariant: ignore log fetch errors */
    }
    try {
        await container.stop();
    } catch {
        /* invariant: ignore stop errors */
    }
    return {
        name: handle.serviceName ?? handle.type,
        type: handle.type,
        durationMs: Date.now() - failed.since,
        error: error instanceof Error ? error.message : String(error),
        logs,
    };
}

export class Orchestrator {
    private readonly services: Record<string, ServiceHandle>;
    private readonly root: string;
    private readonly subject: AppInfo;
    private containers: ContainerPort[] = [];
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
        const handles = Object.values(this.services);
        const embedded = handles.filter((handle) => handle.defaultPort === 0);
        const contained = handles
            .filter((handle) => handle.defaultPort !== 0)
            .map((handle) => ({ container: containerFor(handle), handle }));

        const startedAt = Date.now();
        await Promise.all([
            ...contained.map(async ({ container }) => {
                await container.start();
            }),
            ...embedded.map(async (handle) => {
                await handle.initialize(dockerDir, this.root);
                handle.started = true;
            }),
        ]);

        const reports: ServiceReport[] = [];
        for (const { container, handle } of contained) {
            const since = Date.now();
            try {
                reports.push(await this.connect(container, handle, dockerDir));
            } catch (error) {
                reports.push(
                    await abandoned({ container, error, handle, logsSince: startedAt, since }),
                );
                // oxlint-disable-next-line eslint/no-console -- outside: vitest attributes console output to the file that printed it, which is where a failed start is read
                console.error(formatStartupReport(reports, this.subject));
                throw error;
            }
        }

        this.started = true;
        // oxlint-disable-next-line eslint/no-console -- outside: vitest attributes console output to the file that printed it, which is where the started services are read
        console.log(formatStartupReport(reports, this.subject));
    }

    private async connect(
        container: ContainerPort,
        handle: ServiceHandle,
        dockerDir: string,
    ): Promise<ServiceReport> {
        const since = Date.now();
        handle.connectionString = handle.buildConnectionString(
            container.getHost(),
            container.getMappedPort(handle.defaultPort),
        );
        await handle.healthcheck();
        await handle.initialize(dockerDir, this.root);
        handle.started = true;
        this.containers.push(container);
        return {
            name: handle.serviceName ?? handle.type,
            type: handle.type,
            connectionString: handle.connectionString,
            durationMs: Date.now() - since,
        };
    }

    async stop(): Promise<void> {
        for (const container of this.containers) {
            await container.stop();
        }
        this.containers = [];
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
