/**
 * HTTP response returned by a server port.
 */
export interface ServerResponse {
  status: number;
  body: unknown;
  headers: Record<string, string>;
}

/**
 * Abstract server interface for specification runners.
 * Integration mode uses in-process app, E2E mode uses real HTTP.
 */
export interface ServerPort {
  /** Send an HTTP request and return the response. */
  request(method: string, path: string, body?: unknown): Promise<ServerResponse>;
}
