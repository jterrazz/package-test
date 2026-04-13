import type { ServerPort, ServerResponse } from '../ports/server.port.js';

/**
 * Server adapter that sends real HTTP requests via the Fetch API.
 * Used by the `e2e()` specification runner to hit a live server.
 */
export class FetchAdapter implements ServerPort {
    private baseUrl: string;

    constructor(url: string) {
        this.baseUrl = url.replace(/\/$/, '');
    }

    async request(method: string, path: string, body?: unknown): Promise<ServerResponse> {
        const init: RequestInit = {
            method,
            headers: { 'Content-Type': 'application/json' },
        };

        if (body !== undefined) {
            init.body = JSON.stringify(body);
        }

        const response = await fetch(`${this.baseUrl}${path}`, init);
        const responseBody = await response.json().catch(() => null);

        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => {
            headers[key] = value;
        });

        return {
            status: response.status,
            body: responseBody,
            headers,
        };
    }
}
