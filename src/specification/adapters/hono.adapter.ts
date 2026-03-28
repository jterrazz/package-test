import type { ServerPort, ServerResponse } from "../ports/server.port.js";

/**
 * Server adapter for Hono — in-process requests, no real HTTP.
 * Used by integration() specification runner.
 */
export class HonoAdapter implements ServerPort {
  private app: {
    request: (path: string, init?: RequestInit) => Promise<Response>;
  };

  constructor(app: { request: (path: string, init?: RequestInit) => Promise<Response> }) {
    this.app = app;
  }

  async request(method: string, path: string, body?: unknown): Promise<ServerResponse> {
    const init: RequestInit = {
      method,
      headers: { "Content-Type": "application/json" },
    };

    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    const response = await this.app.request(path, init);
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
