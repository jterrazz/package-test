import type { ContainerPort, ContainerRequest } from '../../model/ports/container.port.js';
import { RunContainer } from './run-container.js';
import { TestcontainersAdapter } from './testcontainers.js';

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
