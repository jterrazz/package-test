import { bodyKind, readBody } from '../../../expectations/http/http-file.js';
import type { Route, SentRequest } from '../routes/routes.js';
import type { ServerPort, ServerRequestOptions, ServerResponse } from './server.port.js';

type TableEntry = { handler?: unknown; method: string; path: string };

/** The app `specification.api()` sends requests to: anything with Hono's `app.request()`. */
export type HonoApp = {
    request: (path: string, init?: RequestInit) => Promise<Response> | Response;
    routes?: readonly TableEntry[];
};

/** Where Hono keeps the handler a wrapper composes (`route()` under an error handler). */
const COMPOSED_HANDLER = '__COMPOSED_HANDLER';

function targetOf(handler: unknown): unknown {
    const composed: unknown =
        typeof handler === 'function' ? Reflect.get(handler, COMPOSED_HANDLER) : undefined;
    return composed === undefined ? handler : targetOf(composed);
}

/** Hono's own `isMiddleware` rule: a handler taking `next` is middleware. */
function isMiddleware(entry: TableEntry): boolean {
    const handler = targetOf(entry.handler);
    return typeof handler === 'function' && handler.length > 1;
}

export class HonoAdapter implements ServerPort {
    private readonly app: HonoApp;
    readonly reached: SentRequest[] = [];

    constructor(app: HonoApp) {
        this.app = app;
    }

    /** Hono's `app.routes`, less the middleware entries; `undefined` for an app with no table. */
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
        // invariant: set, never spread: a header name is case-blind, and a stated `content-type` replaces the JSON default rather than joining it.
        const sent = new Headers({ 'content-type': 'application/json' });
        for (const [name, value] of Object.entries(headers ?? {})) {
            sent.set(name, value);
        }
        const init: RequestInit = {
            // invariant: strings are pre-serialized (a `__requests__/*.http` body); everything else is JSON, and no body stringifies to none.
            body: typeof body === 'string' ? body : JSON.stringify(body),
            headers: sent,
            method,
        };

        this.reached.push(template === undefined ? { method, path } : { method, path, template });
        const response = await this.app.request(path, init);
        const contentType = response.headers.get('content-type') ?? undefined;
        const responseBody =
            bodyKind(contentType) === 'binary'
                ? null
                : (readBody(await response.text(), contentType) ?? null);

        const responseHeaders: Record<string, string> = Object.fromEntries(response.headers);

        return {
            status: response.status,
            body: responseBody,
            headers: responseHeaders,
        };
    }
}
