import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';

import type { ChainConfig } from '../../../chain/config.js';
import { listenedPort } from '../../../chain/listened-port.js';
import { pause } from '../../../chain/pause.js';
import { refusal } from '../../../chain/refusals/refusal.js';
import { isStreamBody } from '../../exchange.js';
import type { MatchableRequest, StubResponse } from '../../exchange.js';
import { StubQueue } from '../../matching/stub-queue.js';
import type { Stub } from '../../stub.js';
import { toReadableStream } from '../stream-body.js';

type StubBackendOptions = {
    // invariant: fixed port: a bundler inlining the URL at serve time survives warm.
    port?: number | undefined;
};

export type StubsConfig = ChainConfig & {
    backend?: StubBackend | undefined;
    /** Allow-listed through the browser's `external: 'block'` policy. */
    backendUrl?: string | undefined;
};

type UnmatchedStubRequest = {
    count: number;
    method: string;
    path: string;
};

const CORS_METHODS = 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS';
const PREFLIGHT_MAX_AGE = '600';

/** A request matching no stub gets 501 and is recorded; once the chain declared a stub, the action throws naming every unmatched request. Every response carries permissive CORS headers. */
export class StubBackend {
    private guarded = false;
    private readonly options: StubBackendOptions;
    private queue = new StubQueue([]);
    private readonly received: MatchableRequest[] = [];
    private server: null | Server = null;
    private readonly unmatchedRequests = new Map<string, UnmatchedStubRequest>();

    constructor(options: StubBackendOptions = {}) {
        this.options = options;
    }

    async start(): Promise<string> {
        const server = createServer((request, response) => {
            void this.handle(request, response);
        });
        this.server = server;

        // Stryker disable next-line StringLiteral: bound to loopback alone, the backend is unreachable from the network, which no test on this machine sees
        const port = await listenedPort(server, {
            host: '127.0.0.1',
            port: this.options.port ?? 0,
        });
        return `http://127.0.0.1:${port}`;
    }

    async stop(): Promise<void> {
        const { server } = this;
        if (!server) {
            return;
        }
        this.server = null;
        server.closeAllConnections();
        await new Promise<void>((resolve) => {
            server.close(() => {
                resolve();
            });
        });
    }

    /** The chain's stubs replace the previous chain's wholesale; the queue and the unmatched log restart. */
    beginChain(stubs: readonly Stub[]): void {
        this.guarded = stubs.length > 0;
        this.queue = new StubQueue(stubs);
        this.unmatchedRequests.clear();
        this.received.length = 0;
    }

    /** Every request the backend was sent since the chain began, in arrival order, matched or not: what a binary SENT, to compare whole. A preflight is no request of the program's. */
    requests(): MatchableRequest[] {
        return this.received.map((request) => ({ ...request, headers: { ...request.headers } }));
    }

    /** Non-null when the chain declared a stub and a request went unmatched, a never stub was reached, or a `required` stub was never met. */
    violation(): Error | null {
        if (!this.guarded) {
            return null;
        }
        if (this.unmatchedRequests.size === 0) {
            return this.queue.verdict();
        }
        const unmatched = [...this.unmatchedRequests.values()]
            .map(
                (entry) =>
                    `  - ${entry.method} ${entry.path}${entry.count > 1 ? ` (${entry.count} times)` : ''}`,
            )
            .join('\n');
        const declared = this.queue
            .declaredRoutes()
            .map((route) => `  - ${route}`)
            .join('\n');
        const strict = new Error(
            refusal('network-strict-after-first-stub', {
                fix: "add a stub for each to the chain's composite",
                found: `unmatched request(s) hit the declared backend during the chain:\n${unmatched}\ndeclared stubs:\n${declared}`,
            }),
        );
        return this.queue.verdict(strict);
    }

    private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
        // Stryker disable next-line StringLiteral: a request an http.Server hands over always carries its method
        const method = (request.method ?? 'GET').toUpperCase();
        const cors = corsHeaders(request);

        // invariant: CORS preflight: always answered, whatever is declared.
        if (method === 'OPTIONS') {
            response.writeHead(204, cors);
            response.end();
            return;
        }

        // Stryker disable next-line StringLiteral: a request an http.Server hands over always carries its url
        const url = request.url ?? '/';
        const observed: MatchableRequest = {
            body: await readBody(request),
            headers: stringHeaders(request),
            method,
            url,
        };
        this.received.push(observed);
        const stub = this.queue.take(observed);
        if (!stub) {
            this.record(method, url);
            response.writeHead(501, { ...cors, 'content-type': 'application/json' });
            response.end(
                JSON.stringify({
                    declared: this.queue.declaredRoutes(),
                    error: `@jterrazz/test declared backend: no stub matches ${method} ${url}`,
                }),
            );
            return;
        }

        const reply = typeof stub.response === 'function' ? stub.response(observed) : stub.response;
        await pause(reply.delay ?? 0);
        if (reply.transport === 'network-error') {
            request.socket.destroy();
            return;
        }
        await writeReply(response, reply, cors);
    }

    private record(method: string, path: string): void {
        const key = `${method} ${path}`;
        const existing = this.unmatchedRequests.get(key);
        if (existing) {
            existing.count += 1;
        } else {
            this.unmatchedRequests.set(key, { count: 1, method, path });
        }
    }
}

// outside: Node names every header in lower case; a header sent twice as a list is no single value to match.
function stringHeaders(request: IncomingMessage): Record<string, string> {
    return Object.fromEntries(
        Object.entries(request.headers).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
    );
}

async function writeReply(
    response: ServerResponse,
    reply: StubResponse,
    cors: Record<string, string>,
): Promise<void> {
    const status = reply.status ?? 200;
    const { body } = reply;
    if (isStreamBody(body)) {
        // invariant: a declared stream is written piece by piece with the connection held open: the order is what the client is specified against.
        response.writeHead(status, { ...cors, 'content-type': body.contentType, ...reply.headers });
        await toReadableStream(body).pipeTo(
            new WritableStream<Uint8Array>({
                close() {
                    response.end();
                },
                write(chunk) {
                    response.write(chunk);
                },
            }),
        );
        return;
    }
    if (body === null || body === undefined) {
        response.writeHead(status, { ...cors, ...reply.headers });
        response.end();
        return;
    }
    const contentType = typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json';
    response.writeHead(status, { ...cors, 'content-type': contentType, ...reply.headers });
    response.end(typeof body === 'string' ? body : JSON.stringify(body));
}

async function readBody(request: IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    }
    const raw = Buffer.concat(chunks).toString('utf8');
    if (raw.length === 0) {
        return null;
    }
    try {
        return JSON.parse(raw);
    } catch {
        return raw;
    }
}

function corsHeaders(request: IncomingMessage): Record<string, string> {
    return {
        'access-control-allow-headers': request.headers['access-control-request-headers'] ?? '*',
        'access-control-allow-methods': CORS_METHODS,
        'access-control-allow-origin': '*',
        'access-control-max-age': PREFLIGHT_MAX_AGE,
    };
}
