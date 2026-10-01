import { invariant, refusal } from '../../../../lint/refusal.js';
import type { ContainerPort, ContainerRequest } from './container.port.js';
import { field } from './run-containers.js';
import type { RunAddress } from './run-containers.js';

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

function relayed(message: string, image: string): Error {
    return new Error(
        refusal({
            fix: 'fix what the reason names, and run again',
            found: `the run's setup could not start ${image}:\n  ${message.replaceAll('\n', '\n  ')}`,
            read: 'docs/17-services.md#one-container-per-run',
            why: 'A container is started once per run, by the run’s setup, and a worker asks it for the address.',
        }),
    );
}

/** Started by asking the run's setup, never stopped by the worker. */
export class RunSetupContainer implements ContainerPort {
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
            throw relayed(answer.error, this.request.image);
        }
        this.address = answer;
    }

    async stop(): Promise<void> {
        this.address = null;
        await Promise.resolve();
    }

    getMappedPort(containerPort: number): number {
        const address = this.started();
        if (containerPort !== this.request.port) {
            throw invariant(
                `the container of the run exposes ${this.request.port}, and ${containerPort} was asked`,
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

    async getLogs(since?: Date): Promise<string> {
        if (this.address === null) {
            return '';
        }
        const query = new URLSearchParams({ key: this.address.key });
        if (since !== undefined) {
            query.set('since', String(since.getTime()));
        }
        const response = await fetch(`${this.url}/logs?${query.toString()}`);
        return await response.text();
    }

    private started(): RunAddress {
        if (this.address === null) {
            throw invariant('a container of the run was read before it started');
        }
        return this.address;
    }
}
