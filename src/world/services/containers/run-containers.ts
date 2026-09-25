import { once } from 'node:events';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { text } from 'node:stream/consumers';

import type { ContainerPort, ContainerRequest } from './container.port.js';

/**
 * The containers of one project of a run, started once and shared by every file.
 *
 * A project's global setup holds one {@link RunContainers} in the main
 * process and serves it on a loopback port; each worker's orchestrator asks it
 * for the container a handle declares, through a `RunContainer`. Two
 * requests alike — same image, port, environment and options — are answered
 * by one container, started by the first and awaited by the rest. The run
 * stops every one of them at teardown; a worker never stops what it did not
 * start.
 */

/** Where a started container is reached, and the key its logs are asked by. */
export type RunAddress = { host: string; key: string; port: number };

/** A value whose objects list their keys in one order. */
function canonical(value: unknown): unknown {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? Object.fromEntries(
              Object.entries(value)
                  .toSorted(([a], [b]) => (a < b ? -1 : 1))
                  .map(([key, entry]) => [key, canonical(entry)]),
          )
        : value;
}

/** A request's identity: the same request spelled in any key order is one key. */
function keyOf(request: ContainerRequest): string {
    return JSON.stringify(canonical(request));
}

export class RunContainers {
    private readonly started = new Map<string, Promise<ContainerPort>>();
    private readonly create: (request: ContainerRequest) => ContainerPort;
    private readonly ready: () => Promise<void>;

    /**
     * @param create - builds the container a request names, not yet started
     * @param ready - resolves once the runtime can start one; its rejection is
     *   the one answer every request gets, and no container is created
     */
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

    /** Stop every container the project started, whatever the others did. */
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
            // A start that failed is not the project's container: the next request tries again.
            this.started.delete(key);
            throw error;
        }
    }
}

/** The project's containers, served on a loopback port. */
export type ServedContainers = { close: () => Promise<void>; url: string };

/** An object's own field, when it has one. */
export function field(value: unknown, name: string): unknown {
    if (typeof value !== 'object' || value === null) {
        return undefined;
    }
    const entry: unknown = Reflect.get(value, name);
    return entry;
}

/** A request as a worker sent it: an image and a port at least; the rest is the runtime's to read. */
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
                throw new Error(`not a container request: ${JSON.stringify(asked)}`);
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
        throw new Error('the run containers are served on no port');
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
