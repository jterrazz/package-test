import type { ServerPort, ServerResponse } from '../../model/ports/server.port.js';
import type { Route } from '../../model/routes/routes.js';

/** The app, as the adapter reaches it: a request, and — a Hono app's — its route table. */
type InProcessApp = {
    request: (path: string, init?: RequestInit) => Promise<Response> | Response;
    routes?: readonly { method: string; path: string }[];
};

/**
 * Server adapter that dispatches requests in-process through a Hono app
 * instance — no network overhead — and records every request it sent, the
 * measure route coverage is taken against.
 */
export class HonoAdapter implements ServerPort {
    private readonly app: InProcessApp;
    /** Every request sent through this adapter, in the order it was sent. */
    readonly reached: Route[] = [];

    constructor(app: InProcessApp) {
        this.app = app;
    }

    /**
     * The routes the app declares — Hono's `app.routes`, less the `ALL`
     * entries a middleware registers — or `undefined` for an app with no table.
     */
    declared(): Route[] | undefined {
        return this.app.routes
            ?.filter((route) => route.method !== 'ALL')
            .map((route) => ({ method: route.method, path: route.path }));
    }

    async request(
        method: string,
        path: string,
        body?: unknown,
        headers?: Record<string, string>,
    ): Promise<ServerResponse> {
        const init: RequestInit = {
            method,
            headers: { 'Content-Type': 'application/json', ...headers },
        };

        if (body !== undefined) {
            // Strings are pre-serialized (e.g. the body section of a
            // Requests/*.http file); everything else is JSON.
            init.body = typeof body === 'string' ? body : JSON.stringify(body);
        }

        this.reached.push({ method, path });
        const response = await this.app.request(path, init);
        const responseBody = await response.json().catch(() => null);

        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
            responseHeaders[key] = value;
        });

        return {
            status: response.status,
            body: responseBody,
            headers: responseHeaders,
        };
    }
}
