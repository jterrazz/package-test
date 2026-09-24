import type { ContainerPort, ContainerRequest } from '../../model/ports/container.port.js';
import { field } from './run-containers.js';
import type { RunAddress } from './run-containers.js';

/** The run's answer to a request: where the container is, or why there is none. */
function answered(value: unknown): RunAddress | { error: string } {
    const error = field(value, 'error');
    if (typeof error === 'string') {
        return { error };
    }
    const host = field(value, 'host');
    const key = field(value, 'key');
    const port = field(value, 'port');
    if (typeof host === 'string' && typeof key === 'string' && typeof port === 'number') {
        return { host, key, port };
    }
    return { error: `the run answered no container: ${JSON.stringify(value)}` };
}

/**
 * A container of the run, as a worker holds it: started by asking the run,
 * never stopped by the worker, its logs read from the run.
 */
export class RunContainer implements ContainerPort {
    private address: null | RunAddress = null;
    private readonly url: string;
    private readonly request: ContainerRequest;

    constructor(url: string, request: ContainerRequest) {
        this.url = url;
        this.request = request;
    }

    async start(): Promise<void> {
        const response = await fetch(`${this.url}/containers`, {
            body: JSON.stringify(this.request),
            headers: { 'content-type': 'application/json' },
            method: 'POST',
        });
        const answer = answered(await response.json());
        if ('error' in answer) {
            throw new Error(answer.error);
        }
        this.address = answer;
    }

    /** Let go of the container — the run started it, and the run's teardown stops it. */
    async stop(): Promise<void> {
        this.address = null;
        await Promise.resolve();
    }

    getMappedPort(containerPort: number): number {
        const address = this.started();
        if (containerPort !== this.request.port) {
            throw new Error(
                `Container of the run exposes ${this.request.port}, not ${containerPort}`,
            );
        }
        return address.port;
    }

    getHost(): string {
        return this.started().host;
    }

    getConnectionString(): string {
        const { host, port } = this.started();
        return `${host}:${port}`;
    }

    async getLogs(): Promise<string> {
        if (this.address === null) {
            return '';
        }
        const response = await fetch(
            `${this.url}/logs?key=${encodeURIComponent(this.address.key)}`,
        );
        return await response.text();
    }

    private started(): RunAddress {
        if (this.address === null) {
            throw new Error('Container not started');
        }
        return this.address;
    }
}
