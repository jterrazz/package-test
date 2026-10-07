import { tmpdir } from 'node:os';
import { vi } from 'vitest';

import { clock } from '../../../clock/clock.js';
import type { ContainerPort, ContainerRequest } from '../../containers/container.port.js';
import type { DatabasePort } from '../../database.port.js';
import type { ServiceHandle } from '../../service.port.js';
import { Orchestrator } from '../orchestrator.js';
import { registerContainerIntegrations } from '../registry.js';

/** Every call the services and their containers receive, in order, as one line each. */
export type CallLog = string[];

async function settled(): Promise<void> {
    await Promise.resolve();
}

export type FakeContainerOptions = {
    logs?: () => Promise<string>;
    start?: () => Promise<void>;
    stop?: () => Promise<void>;
};

/** Containers built by the orchestrator from now on are fakes logging into `log`; the requests they were built from are returned. */
export function fakeContainers(
    log: CallLog,
    options: FakeContainerOptions = {},
): ContainerRequest[] {
    const requests: ContainerRequest[] = [];
    registerContainerIntegrations({
        createContainer: (request) => {
            requests.push(request);
            const name = request.image;
            const container: ContainerPort = {
                getConnectionString: () => `${name}:conn`,
                getHost: () => 'host.test',
                getLogs: async (since?: Date) => {
                    log.push(`logs ${name} since ${since?.toISOString() ?? 'all'}`);
                    return await (options.logs?.() ?? Promise.resolve(`${name} booted`));
                },
                getMappedPort: (port) => port + 10_000,
                start: async () => {
                    log.push(`start ${name}`);
                    await (options.start?.() ?? settled());
                },
                stop: async () => {
                    log.push(`stop ${name}`);
                    await (options.stop?.() ?? settled());
                },
            };
            return container;
        },
    });
    return requests;
}

export type FakeServiceOptions = Partial<
    Pick<ServiceHandle, 'containerOptions' | 'defaultPort' | 'environment'>
> & {
    database?: DatabasePort;
    healthcheck?: () => Promise<void>;
};

/** A service named by its image, logging what the orchestrator asks of it. */
export function fakeService(
    log: CallLog,
    image: string,
    options: FakeServiceOptions = {},
): ServiceHandle {
    const handle: ServiceHandle = {
        buildConnectionString: (host, port) => `fake://${host}:${port}`,
        connectionString: '',
        ...(options.containerOptions === undefined
            ? {}
            : { containerOptions: options.containerOptions }),
        createDatabaseAdapter: () => options.database ?? null,
        defaultImage: image,
        defaultPort: options.defaultPort ?? 5432,
        environment: options.environment ?? {},
        healthcheck: async () => {
            log.push(`health ${image}`);
            await (options.healthcheck?.() ?? settled());
        },
        initialize: async (dockerDir, root) => {
            log.push(`initialize ${image} ${dockerDir.slice(root.length)}`);
            await clock.advance(5);
        },
        isolation: () => ({
            acquire: async (worker) => {
                log.push(`acquire ${image} ${worker}`);
                await settled();
            },
            release: async () => {
                log.push(`release ${image}`);
                await settled();
            },
            reset: settled,
        }),
        reset: settled,
        serviceName: null,
        type: image.split(':')[0] ?? image,
    };
    return handle;
}

// oxlint-disable-next-line no-control-regex -- the ANSI escape IS the control character: dropping it is the point
export const plain = (text: unknown): string => String(text).replaceAll(/\u001B\[[0-9;]*m/gu, '');

/** A start of one service whose health check fails as given: what it rejected with, the report it printed, every call made. */
export async function failedStart(
    key: string,
    image: string,
    failure: () => Promise<void>,
    containers: FakeContainerOptions = {},
): Promise<{ log: CallLog; rejection: unknown; report: string[] }> {
    const report = vi.spyOn(console, 'error').mockReturnValue();
    const log: CallLog = [];
    fakeContainers(log, containers);
    const orchestrator = new Orchestrator({
        root: tmpdir(),
        services: { [key]: fakeService(log, image, { healthcheck: failure }) },
    });
    const rejection = await orchestrator.start().then(
        () => 'started',
        (error: unknown) => error,
    );
    const printed = report.mock.calls.map(([text]) => plain(text));
    report.mockRestore();
    return { log, rejection, report: printed };
}

/** Two contained services, one with options of its own, and an embedded one. */
export function mixedServices(log: CallLog): Record<string, ServiceHandle> {
    return {
        analyticsDb: fakeService(log, 'postgres:16', {
            containerOptions: { command: ['-c', 'fsync=off'] },
            environment: { POSTGRES_DB: 'a' },
        }),
        cache: fakeService(log, 'redis:7', { defaultPort: 6379 }),
        files: fakeService(log, 'sqlite', { defaultPort: 0 }),
    };
}
