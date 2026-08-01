/**
 * The declared stub backend — a small `node:http` server the website and
 * mobile runners start when their `backend` option is present. It serves the
 * contracts the CURRENT chain declared via `.intercept(...)`: one chain = one
 * terminal action, and the stub resets between chains the way databases do.
 *
 * Selection is the shared {@link ContractQueue} — the same first-matching,
 * `times`-aware queue the MSW engine runs on api/jobs chains. A contract
 * without `times` keeps replying (re-render, retry); `times: n` is spent after
 * n serves.
 *
 * Strictness is the `external: 'block'` analog (CONVENTIONS D7 in spirit): a
 * request matching no contract is answered 501 and RECORDED; once the chain
 * declared at least one contract, the terminal action throws an error
 * enumerating every unmatched request — and every `required` contract that was
 * never requested. Chains with zero contracts leave the stub unguarded —
 * mirroring how MSW stays off without them.
 *
 * Every response (including the 501 and the OPTIONS preflight) carries
 * permissive CORS headers — a website's client-side fetches are cross-origin
 * to the stub by construction.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import type { Contract } from '../../contracts/contract.js';
import { ContractQueue } from '../../contracts/queue.js';
import type { MatchableRequest } from '../../contracts/types.js';

/** Options for the stub backend server. */
interface StubBackendOptions {
    /**
     * Fixed port — pins a stable stub URL across runs (a bundler that inlines
     * the URL at serve time survives warm). Default: a free OS-assigned port.
     */
    port?: number;
}

/** One unmatched request family recorded during a chain. */
interface UnmatchedStubRequest {
    count: number;
    method: string;
    path: string;
}

const CORS_METHODS = 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS';
const PREFLIGHT_MAX_AGE = '600';

export class StubBackend {
    /** Guarded once the current chain declared at least one contract. */
    private guarded = false;
    private readonly options: StubBackendOptions;
    private queue = new ContractQueue([]);
    private server: null | Server = null;
    private readonly unmatchedRequests = new Map<string, UnmatchedStubRequest>();
    private url = '';

    constructor(options: StubBackendOptions = {}) {
        this.options = options;
    }

    /** Start the server and resolve with its base URL. */
    async start(): Promise<string> {
        const server = createServer((request, response) => {
            void this.handle(request, response);
        });
        this.server = server;

        await new Promise<void>((resolve, reject) => {
            server.once('error', reject);
            server.listen(this.options.port ?? 0, '127.0.0.1', () => resolve());
        });

        const address = server.address();
        if (address === null || typeof address === 'string') {
            throw new Error('stub backend: could not determine the listening port');
        }
        this.url = `http://127.0.0.1:${address.port}`;
        return this.url;
    }

    /** Stop the server (idempotent). */
    async stop(): Promise<void> {
        const server = this.server;
        if (!server) {
            return;
        }
        this.server = null;
        server.closeAllConnections();
        await new Promise<void>((resolve) => {
            server.close(() => resolve());
        });
    }

    /**
     * Arm the stub for one chain: the declared contracts replace the previous
     * chain's wholesale, the queue restarts, and the unmatched log clears —
     * the reset-between-chains databases already follow.
     */
    beginChain(contracts: readonly Contract[]): void {
        this.guarded = contracts.length > 0;
        this.queue = new ContractQueue(contracts);
        this.unmatchedRequests.clear();
    }

    /**
     * The strict failure for the chain, or null. Non-null when the chain
     * declared at least one contract AND either an unmatched request was
     * recorded, or a `required` contract was never satisfied. Enumerates every
     * unmatched request (method, path, count) plus the declared routes, so the
     * missing contract writes itself.
     */
    violation(): Error | null {
        if (!this.guarded) {
            return null;
        }
        if (this.unmatchedRequests.size === 0) {
            return this.queue.requiredError();
        }
        const unmatched = [...this.unmatchedRequests.values()]
            .map(
                (entry) =>
                    `  - ${entry.method} ${entry.path}${entry.count > 1 ? ` (${entry.count} times)` : ''}`,
            )
            .join('\n');
        return new Error(
            `Unmatched request(s) hit the declared backend during the chain:\n${unmatched}\n` +
                `Declared contracts:\n${this.describeRoutes()}\n` +
                `Every backend request of a chain that declares contracts must match one — ` +
                `add a contract for it to the chain's composite.`,
        );
    }

    // ── Private ──

    private corsHeaders(request: IncomingMessage): Record<string, string> {
        return {
            'access-control-allow-headers':
                (request.headers['access-control-request-headers'] as string | undefined) ?? '*',
            'access-control-allow-methods': CORS_METHODS,
            'access-control-allow-origin': '*',
            'access-control-max-age': PREFLIGHT_MAX_AGE,
        };
    }

    private describeRoutes(): string {
        const routes = this.queue.declaredRoutes();
        if (routes.length === 0) {
            return '  (no contracts declared)';
        }
        return routes.map((route) => `  - ${route}`).join('\n');
    }

    private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
        const method = (request.method ?? 'GET').toUpperCase();
        const cors = this.corsHeaders(request);

        // CORS preflight — always answered, whatever is declared.
        if (method === 'OPTIONS') {
            response.writeHead(204, cors);
            response.end();
            return;
        }

        const headers: Record<string, string> = {};
        for (const [name, value] of Object.entries(request.headers)) {
            if (typeof value === 'string') {
                headers[name.toLowerCase()] = value;
            }
        }
        const url = request.url ?? '/';
        // The body is read off the stream so `match` predicates and body
        // Filters see the payload — the stub is a real server, not MSW.
        const observed: MatchableRequest = {
            body: await readBody(request),
            headers,
            method,
            url,
        };
        const contract = this.queue.take(observed);

        if (!contract) {
            this.record(method, url);
            response.writeHead(501, { ...cors, 'content-type': 'application/json' });
            response.end(
                JSON.stringify({
                    declared: this.queue.declaredRoutes(),
                    error: `@jterrazz/test declared backend: no contract matches ${method} ${url}`,
                }),
            );
            return;
        }

        const reply =
            typeof contract.response === 'function'
                ? contract.response(observed)
                : contract.response;

        if (reply.delay) {
            await new Promise((resolve) => setTimeout(resolve, reply.delay));
        }

        const status = reply.status ?? 200;
        const { body } = reply;
        if (body === null || body === undefined) {
            response.writeHead(status, { ...cors, ...reply.headers });
            response.end();
            return;
        }
        const payload = typeof body === 'string' ? body : JSON.stringify(body);
        const contentType =
            typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json';
        response.writeHead(status, {
            ...cors,
            'content-type': contentType,
            ...reply.headers,
        });
        response.end(payload);
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

/** Read the request body — parsed JSON when it is JSON, raw text otherwise. */
async function readBody(request: IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
        chunks.push(chunk as Buffer);
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
