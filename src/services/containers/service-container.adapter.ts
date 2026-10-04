import { invariant } from '../../chain/refusals/refusal.js';
import type { ContainerPort, ContainerRequest } from './container.port.js';
import { RunSetupContainer } from './run-setup-container.adapter.js';
import { TestcontainersAdapter } from './testcontainers.adapter.js';

/** The run's container when a setup serves one, asked for at start; its own otherwise. */
export class ServiceContainer implements ContainerPort {
    private delegate: ContainerPort | null = null;
    private readonly request: ContainerRequest;
    private readonly locate: () => Promise<string | undefined>;

    constructor(request: ContainerRequest, locate: () => Promise<string | undefined>) {
        this.request = request;
        this.locate = locate;
    }

    async start(): Promise<void> {
        const url = await this.locate();
        this.delegate =
            // Stryker disable next-line ConditionalExpression: outside: a container of its own is Docker's to start; the integration specs start one
            url === undefined
                ? new TestcontainersAdapter(this.request)
                : new RunSetupContainer(url, this.request);
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
            throw invariant('a service container was read before it started');
        }
        return this.delegate;
    }
}

export async function serviceContainers(): Promise<string | undefined> {
    try {
        const { inject } = await import('vitest');
        return inject('serviceContainers');
    } catch {
        return undefined;
    }
}

declare module 'vitest' {
    interface ProvidedContext {
        /** The loopback address the run's containers are asked for at. */
        serviceContainers?: string;
    }
}
