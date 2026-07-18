import type { ServerPort, ServerResponse } from '../../ports/server.port.js';

/**
 * Transient connection-level failures against a live compose app. Under
 * parallel load (every `api-stack` worker hammering its own compose project)
 * `fetch` intermittently rejects before the app's keep-alive socket is ready —
 * `undici` surfaces these as `UND_ERR_SOCKET` / `ECONNRESET` / `ECONNREFUSED`.
 * They are races, not real failures, so the request path retries them; an HTTP
 * *response* (any status) is never retried — it is a real answer.
 */
const TRANSIENT_CONNECTION_CODES = new Set([
    'ECONNREFUSED',
    'ECONNRESET',
    'UND_ERR_CONNECT_TIMEOUT',
    'UND_ERR_SOCKET',
]);
/** Bounded retry budget: attempts and the base backoff (doubled each retry). */
const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 50;

function isTransientConnectionError(error: unknown): boolean {
    if (!(error instanceof Error)) {
        return false;
    }
    const cause = error.cause as undefined | { code?: string };
    return (
        (cause?.code !== undefined && TRANSIENT_CONNECTION_CODES.has(cause.code)) ||
        error.message.includes('fetch failed')
    );
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Server adapter that sends real HTTP requests via the Fetch API.
 * Used by the `e2e()` specification runner to hit a live server.
 */
export class FetchAdapter implements ServerPort {
    private baseUrl: string;

    constructor(url: string) {
        this.baseUrl = url.replace(/\/$/, '');
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

        const response = await this.fetchWithRetry(`${this.baseUrl}${path}`, init);
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

    /**
     * `fetch` with a bounded, backing-off retry over transient connection
     * races (see {@link isTransientConnectionError}). The last error is rethrown
     * once the budget is spent so a genuinely-down server still surfaces.
     */
    private async fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
        for (let attempt = 1; ; attempt += 1) {
            try {
                return await fetch(url, init);
            } catch (error) {
                if (attempt >= MAX_ATTEMPTS || !isTransientConnectionError(error)) {
                    throw error;
                }
                await delay(BASE_BACKOFF_MS * 2 ** (attempt - 1));
            }
        }
    }
}
