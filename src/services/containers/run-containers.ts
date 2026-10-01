import { once } from 'node:events';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { text } from 'node:stream/consumers';

import { invariant } from '../../../lint/refusal.js';
import type { ContainerPort, ContainerRequest } from './container.port.js';

/** Two requests alike (image, port, environment, options) share one container; the run stops them all at teardown. */

export type RunAddress = { host: string; key: string; port: number };

function canonical(value: unknown): unknown {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? Object.fromEntries(
              Object.entries(value)
                  .toSorted(([a], [b]) => (a < b ? -1 : 1))
                  .map(([key, entry]) => [key, canonical(entry)]),
          )
        : value;
}

/** The same request spelled in any key order is one key. */
function keyOf(request: ContainerRequest): string {
    return JSON.stringify(canonical(request));
}

export class RunContainers {
    private readonly started = new Map<string, Promise<ContainerPort>>();
    private readonly create: (request: ContainerRequest) => ContainerPort;
    private readonly ready: () => Promise<void>;

    /** `ready`'s rejection is the one answer every request gets, and no container is created. */
    constructor(
        create: (request: ContainerRequest) => ContainerPort,
        ready: () => Promise<void> = async () => {
            // A runtime nothing checks is taken as reachable.
        },
    ) {
        this.create = create;
        this.ready = ready;
    }

    async acquire(request: ContainerRequest): Promise<RunAddress> {
        const key = keyOf(request);
        let pending = this.started.get(key);
        if (pending === undefined) {
            pending = this.start(key, request);
            this.started.set(key, pending);
        }
        const container = await pending;
        return { host: container.getHost(), key, port: container.getMappedPort(request.port) };
    }

    async logs(key: string, since?: Date): Promise<string> {
        const pending = this.started.get(key);
        if (pending === undefined) {
            return '';
        }
        const container = await pending;
        return await container.getLogs(since);
    }

    async stop(): Promise<void> {
        const pending = [...this.started.values()];
        this.started.clear();
        await Promise.allSettled(
            pending.map(async (starting) => {
                const container = await starting;
                await container.stop();
            }),
        );
    }

    private async start(key: string, request: ContainerRequest): Promise<ContainerPort> {
        try {
            await this.ready();
            const container = this.create(request);
            await container.start();
            return container;
        } catch (error) {
            // A start that failed is not the run's container: the next request tries again.
            this.started.delete(key);
            throw error;
        }
    }
}

export type ServedContainers = { close: () => Promise<void>; url: string };

export function field(value: unknown, name: string): unknown {
    if (typeof value !== 'object' || value === null) {
        return undefined;
    }
    const entry: unknown = Reflect.get(value, name);
    return entry;
}

function isContainerRequest(value: unknown): value is ContainerRequest {
    return typeof field(value, 'image') === 'string' && typeof field(value, 'port') === 'number';
}

async function respond(
    containers: RunContainers,
    request: IncomingMessage,
    response: ServerResponse,
): Promise<void> {
    const url = new URL(request.url ?? '/', 'http://run');
    try {
        if (request.method === 'POST' && url.pathname === '/containers') {
            const asked: unknown = JSON.parse(await text(request));
            if (!isContainerRequest(asked)) {
                throw invariant(
                    `a worker asked for ${JSON.stringify(asked)}, no container request`,
                );
            }
            const address = await containers.acquire(asked);
            response.writeHead(200, { 'content-type': 'application/json' });
            response.end(JSON.stringify(address));
            return;
        }
        if (request.method === 'GET' && url.pathname === '/logs') {
            response.writeHead(200, { 'content-type': 'text/plain' });
            const key = url.searchParams.get('key') ?? '';
            const since = url.searchParams.get('since');
            const moment = since === null ? undefined : new Date(Number(since));
            response.end(await containers.logs(key, moment));
            return;
        }
        response.writeHead(404).end();
    } catch (error) {
        response.writeHead(500, { 'content-type': 'application/json' });
        response.end(
            JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
        );
    }
}

export async function serveContainers(containers: RunContainers): Promise<ServedContainers> {
    const server = createServer((request, response) => {
        void respond(containers, request, response);
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (address === null || typeof address === 'string') {
        throw invariant('the run containers are served on no port');
    }
    const { port } = address;
    return {
        close: async () => {
            server.close();
            await once(server, 'close');
        },
        url: `http://127.0.0.1:${port}`,
    };
}
