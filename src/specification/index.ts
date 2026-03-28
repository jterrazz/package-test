import { FetchAdapter } from "./adapters/fetch.adapter.js";
import { HonoAdapter } from "./adapters/hono.adapter.js";
import type { DatabasePort } from "./ports/database.port.js";
import { createSpecificationRunner } from "./specification.js";

/**
 * Create an integration specification runner.
 * Requests are in-process via the app instance — fast, no real HTTP.
 */
function integration(options: {
  database?: DatabasePort;
  app: { request: (path: string, init?: RequestInit) => Promise<Response> };
}) {
  return createSpecificationRunner({
    database: options.database,
    server: new HonoAdapter(options.app),
  });
}

/**
 * Create an E2E specification runner.
 * Requests are real HTTP against a running server.
 */
function e2e(options: { database?: DatabasePort; url: string }) {
  return createSpecificationRunner({
    database: options.database,
    server: new FetchAdapter(options.url),
  });
}

export type { DatabasePort } from "./ports/database.port.js";
export type { ServerPort, ServerResponse } from "./ports/server.port.js";
export { FetchAdapter } from "./adapters/fetch.adapter.js";
export { HonoAdapter } from "./adapters/hono.adapter.js";
export { BetterSqliteAdapter } from "./adapters/better-sqlite.adapter.js";
export { e2e, integration };
