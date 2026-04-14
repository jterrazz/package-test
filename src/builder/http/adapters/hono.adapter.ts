import type { ServerPort, ServerResponse } from '../server.port.js';

/**
 * Server adapter that dispatches requests in-process through a Hono app instance.
 * Used by the `integration()` specification runner -- no network overhead.
 */
export class HonoAdapter implements ServerPort {
    private app: {
        request: (path: string, init?: RequestInit) => Promise<Response> | Response;
    };

    constructor(app: {
        request: (path: string, init?: RequestInit) => Promise<Response> | Response;
    }) {
        this.app = app;
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
            init.body = JSON.stringify(body);
        }

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
