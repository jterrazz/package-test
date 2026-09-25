import type { ContainerPort, ContainerRequest } from './container.port.js';
import { RunContainer } from './run-container.js';
import { TestcontainersAdapter } from './testcontainers.adapter.js';

/**
 * The container a declared service gets: the project's, when its global
 * setup serves one — asked where it is at start, since only then does the
 * worker know — and one of its own otherwise, started and stopped with it.
 */
export class ServiceContainer implements ContainerPort {
    private delegate: ContainerPort | null = null;
    private readonly request: ContainerRequest;
    private readonly locate: () => Promise<string | undefined>;

    /**
     * @param locate - where the project serves its containers, `undefined` when it serves none
     */
    constructor(request: ContainerRequest, locate: () => Promise<string | undefined>) {
        this.request = request;
        this.locate = locate;
    }

    async start(): Promise<void> {
        const url = await this.locate();
        this.delegate =
            url === undefined
                ? new TestcontainersAdapter(this.request)
                : new RunContainer(url, this.request);
        await this.delegate.start();
    }

    async stop(): Promise<void> {
        await this.delegate?.stop();
    }

    getMappedPort(containerPort: number): number {
        return this.started().getMappedPort(containerPort);
    }

    getHost(): string {
        return this.started().getHost();
    }

    getConnectionString(): string {
        return this.started().getConnectionString();
    }

    async getLogs(since?: Date): Promise<string> {
        return (await this.delegate?.getLogs(since)) ?? '';
    }

    private started(): ContainerPort {
        if (this.delegate === null) {
            throw new Error('Container not started');
        }
        return this.delegate;
    }
}

/**
 * Where the run serves its service containers, read on the worker's side —
 * what the global setup of a project whose specs declare services provides;
 * `undefined` for a run that serves none, where each specification starts its
 * own.
 */
export async function serviceContainers(): Promise<string | undefined> {
    try {
        const { inject } = await import('vitest');
        return inject('serviceContainers');
    } catch {
        return undefined;
    }
}

/** Where the project's global setup serves its containers — provided to its workers. */
declare module 'vitest' {
    // oxlint-disable-next-line typescript/consistent-type-definitions -- a module augmentation MERGES only as an interface; a type alias redeclares the name and every member is lost
    interface ProvidedContext {
        /** The loopback address the project's containers are asked for at. */
        serviceContainers?: string;
    }
}
