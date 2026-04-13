/**
 * HTTP response returned by a server port, with parsed JSON body.
 */
export interface ServerResponse {
    /** HTTP status code. */
    status: number;
    /** Parsed JSON response body, or null if parsing failed. */
    body: unknown;
    /** Response headers as a flat key-value map. */
    headers: Record<string, string>;
}

/**
 * Abstract server interface for specification runners.
 * Integration mode uses an in-process Hono app; E2E mode uses real HTTP via fetch.
 */
export interface ServerPort {
    /** Send an HTTP request and return the parsed response. */
    request(method: string, path: string, body?: unknown): Promise<ServerResponse>;
}
