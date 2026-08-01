/**
 * The declared stub backend — a small `node:http` server the website and
 * mobile runners start when their `backend` option is present. It serves the
 * exchanges the CURRENT chain declared via `.intercept('<name>.http')`:
 * one chain = one terminal action, and the stub resets between chains the
 * way databases do.
 *
 * Matching is the `intercepts/*.http` grammar (`exchangeMatches`), with the
 * queue semantics a rendered app needs: same-route entries consume FIFO, and
 * once a route's queue is exhausted its LAST entry stays sticky — a page
 * re-fetching the same endpoint (re-render, retry) replays the final reply
 * instead of failing an honest screen.
 *
 * Strictness is the `external: 'block'` analog (CONVENTIONS D7 in spirit): a
 * request matching no declared exchange is answered 501 and RECORDED; once
 * the chain declared at least one intercept, the terminal action throws an
 * error enumerating every unmatched request. Chains with zero intercepts
 * leave the stub unguarded — mirroring how MSW stays off without them.
 *
 * Every response (including the 501 and the OPTIONS preflight) carries
 * permissive CORS headers — a website's client-side fetches are cross-origin
 * to the stub by construction.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import { exchangeMatches, type InterceptExchange } from '../../http-files/intercept-file.js';

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
    private consumed: boolean[] = [];
    private entries: InterceptExchange[] = [];
    /** Guarded once the current chain declared at least one intercept. */
    private guarded = false;
    private readonly options: StubBackendOptions;
    private server: null | Server = null;
    private readonly unmatchedRequests = new Map<string, UnmatchedStubRequest>();
    private url = '';

    constructor(options: StubBackendOptions = {}) {
        this.options = options;
    }

    /** Start the server and resolve with its base URL. */
    async start(): Promise<string> {
        const server = createServer((request, response) => {
            this.handle(request, response);
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
     * Arm the stub for one chain: the declared exchanges replace the previous
     * chain's wholesale, consumption restarts, and the unmatched log clears —
     * the reset-between-chains databases already follow.
     */
    beginChain(exchanges: InterceptExchange[]): void {
        this.consumed = exchanges.map(() => false);
        this.entries = exchanges;
        this.guarded = exchanges.length > 0;
        this.unmatchedRequests.clear();
    }

    /**
     * The strict failure for the chain, or null — non-null when the chain
     * declared at least one intercept AND an unmatched request was recorded.
     * Enumerates every unmatched request (method, path, count) plus the
     * declared routes, so the missing exchange writes itself.
     */
    violation(): Error | null {
        if (!this.guarded || this.unmatchedRequests.size === 0) {
            return null;
        }
        const unmatched = [...this.unmatchedRequests.values()]
            .map(
                (entry) =>
                    `  - ${entry.method} ${entry.path}${entry.count > 1 ? ` (${entry.count} times)` : ''}`,
            )
            .join('\n');
        return new Error(
            `Unmatched request(s) hit the declared backend during the chain:\n${unmatched}\n` +
                `Declared exchanges:\n${this.describeRoutes()}\n` +
                `Every backend request of a chain that declares intercepts must match one — ` +
                `add an exchange for it to the chain's intercepts/*.http file.`,
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
        if (this.entries.length === 0) {
            return '  (no exchanges declared)';
        }
        return this.entries
            .map(
                (entry, i) =>
                    `  - ${entry.request.method} ${entry.request.path}${this.consumed[i] ? ' (consumed)' : ''}`,
            )
            .join('\n');
    }

    private handle(request: IncomingMessage, response: ServerResponse): void {
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
        const entry = this.take({ headers, method, url });

        if (!entry) {
            this.record(method, url);
            response.writeHead(501, { ...cors, 'content-type': 'application/json' });
            response.end(
                JSON.stringify({
                    declared: this.entries.map(
                        (declared) => `${declared.request.method} ${declared.request.path}`,
                    ),
                    error: `@jterrazz/test declared backend: no exchange matches ${method} ${url}`,
                }),
            );
            return;
        }

        const { body, hasBody, status } = entry.response;
        if (!hasBody) {
            response.writeHead(status, { ...cors, ...entry.response.headers });
            response.end();
            return;
        }
        const payload = typeof body === 'string' ? body : JSON.stringify(body);
        const contentType =
            typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json';
        response.writeHead(status, {
            ...cors,
            'content-type': contentType,
            ...entry.response.headers,
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

    /**
     * FIFO with a sticky tail: the first unconsumed matching exchange is
     * consumed; when every matching exchange is spent, the LAST one keeps
     * replying.
     */
    private take(observed: {
        headers: Record<string, string>;
        method: string;
        url: string;
    }): InterceptExchange | null {
        let sticky: InterceptExchange | null = null;
        for (let i = 0; i < this.entries.length; i++) {
            const entry = this.entries[i];
            if (!exchangeMatches(entry.request, observed)) {
                continue;
            }
            if (!this.consumed[i]) {
                this.consumed[i] = true;
                return entry;
            }
            sticky = entry;
        }
        return sticky;
    }
}
