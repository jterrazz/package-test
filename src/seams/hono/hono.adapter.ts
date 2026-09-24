import { readBody } from '../../model/http-files/http-file.js';
import type {
    ServerPort,
    ServerRequestOptions,
    ServerResponse,
} from '../../model/ports/server.port.js';
import type { Route, SentRequest } from '../../model/routes/routes.js';

/** One entry of an app's route table: a method, a path, and — a Hono app's — the handler it runs. */
type TableEntry = { handler?: unknown; method: string; path: string };

/** The app, as the adapter reaches it: a request, and — a Hono app's — its route table. */
type InProcessApp = {
    request: (path: string, init?: RequestInit) => Promise<Response> | Response;
    routes?: readonly TableEntry[];
};

/** The key under which Hono keeps the handler a wrapper composes — `route()` under an error handler. */
const COMPOSED_HANDLER = '__COMPOSED_HANDLER';

/** The handler a wrapper runs, unwrapped as Hono's own route listing unwraps it. */
function targetOf(handler: unknown): unknown {
    const composed: unknown =
        typeof handler === 'function' ? Reflect.get(handler, COMPOSED_HANDLER) : undefined;
    return composed === undefined ? handler : targetOf(composed);
}

/**
 * Does this entry register a middleware? Hono's own rule (`isMiddleware`, what
 * `showRoutes` hides): a handler that takes `next` — `app.use()`'s — where a
 * route's handler, `app.all()`'s included, takes the context alone.
 */
function isMiddleware(entry: TableEntry): boolean {
    const handler = targetOf(entry.handler);
    return typeof handler === 'function' && handler.length > 1;
}

/**
 * Server adapter that dispatches requests in-process through a Hono app
 * instance — no network overhead — and records every request it sent, the
 * measure route coverage is taken against.
 */
export class HonoAdapter implements ServerPort {
    private readonly app: InProcessApp;
    /** Every request sent through this adapter, in the order it was sent. */
    readonly reached: SentRequest[] = [];

    constructor(app: InProcessApp) {
        this.app = app;
    }

    /**
     * The routes the app declares — Hono's `app.routes`, less the entries a
     * middleware registers — or `undefined` for an app with no table.
     */
    declared(): Route[] | undefined {
        return this.app.routes
            ?.filter((entry) => !isMiddleware(entry))
            .map((entry) => ({ method: entry.method, path: entry.path }));
    }

    async request(
        method: string,
        path: string,
        body?: unknown,
        { headers, template }: ServerRequestOptions = {},
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

        this.reached.push(template === undefined ? { method, path } : { method, path, template });
        const response = await this.app.request(path, init);
        const responseBody = readBody(await response.text()) ?? null;

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
