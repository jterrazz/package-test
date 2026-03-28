import { serve } from "@hono/node-server";
import { isAbsolute, resolve } from "node:path";

import { Orchestrator } from "../infrastructure/orchestrator.js";
import type { ServiceHandle } from "../infrastructure/services/service.port.js";
import { FetchAdapter } from "./adapters/fetch.adapter.js";
import { HonoAdapter } from "./adapters/hono.adapter.js";
import type { DatabasePort } from "./ports/database.port.js";
import { createSpecificationRunner, type SpecificationRunner } from "./specification.js";

/**
 * Resolve projectRoot — if relative, resolves from the caller's directory.
 */
function resolveProjectRoot(projectRoot: string | undefined): string {
  if (!projectRoot) {
    return process.cwd();
  }

  if (isAbsolute(projectRoot)) {
    return projectRoot;
  }

  // Resolve relative path from the caller's file location
  const stack = new Error("resolve projectRoot").stack;
  if (stack) {
    const lines = stack.split("\n");
    for (const line of lines) {
      const match = line.match(/at\s+(?:.*?\()?(?:file:\/\/)?([^:)]+):\d+:\d+/);
      if (!match) {
        continue;
      }

      const filePath = match[1];
      if (filePath.includes("node_modules") || filePath.includes("/specification/")) {
        continue;
      }

      return resolve(filePath, "..", projectRoot);
    }
  }

  return resolve(process.cwd(), projectRoot);
}

type HonoApp = {
  fetch: (...args: any[]) => any;
  request: (path: string, init?: RequestInit) => Promise<Response> | Response;
};

interface IntegrationOptions {
  /** Declared services (postgres, redis, sqlite, etc.) */
  services?: ServiceHandle[];
  /** Factory that returns a Hono app — called after services start. */
  app: () => HonoApp;
  /** Override auto-detected database. */
  database?: DatabasePort;
  /** Project root for compose detection. */
  projectRoot?: string;
}

interface E2eOptions {
  /** Declared services (postgres, redis, sqlite, etc.) */
  services?: ServiceHandle[];
  /** Factory that returns a Hono app — started as HTTP server. */
  app: () => HonoApp;
  /** Override app URL (skip starting server). */
  url?: string;
  /** Port for the HTTP server (random by default). */
  port?: number;
  /** Override auto-detected database. */
  database?: DatabasePort;
  /** Project root for compose detection. */
  projectRoot?: string;
}

interface SpecificationRunnerWithCleanup extends SpecificationRunner {
  cleanup: () => Promise<void>;
  orchestrator: Orchestrator;
}

/**
 * Create an integration specification runner.
 * Starts infra containers, builds app in-process.
 *
 * @example
 * const db = postgres({ compose: "db" });
 * export const spec = await integration({
 *     services: [db],
 *     app: () => createApp({ databaseUrl: db.connectionString }),
 * });
 */
async function integration(options: IntegrationOptions): Promise<SpecificationRunnerWithCleanup> {
  const orchestrator = new Orchestrator({
    services: options.services ?? [],
    mode: "integration",
    projectRoot: resolveProjectRoot(options.projectRoot),
  });

  if (options.services && options.services.length > 0) {
    await orchestrator.start();
  }

  const app = options.app();
  const database = options.database ?? orchestrator.getDatabase() ?? undefined;

  const runner = createSpecificationRunner({
    database,
    server: new HonoAdapter(app),
  }) as SpecificationRunnerWithCleanup;

  runner.cleanup = () => orchestrator.stop();
  runner.orchestrator = orchestrator;

  return runner;
}

/**
 * Create an E2E specification runner.
 * Starts infra containers + HTTP server, sends real HTTP requests.
 *
 * @example
 * const db = postgres({ compose: "db" });
 * export const spec = await e2e({
 *     services: [db],
 *     app: () => createApp({ databaseUrl: db.connectionString }),
 * });
 */
async function e2e(options: E2eOptions): Promise<SpecificationRunnerWithCleanup> {
  const orchestrator = new Orchestrator({
    services: options.services ?? [],
    mode: "e2e",
    projectRoot: resolveProjectRoot(options.projectRoot),
  });

  if (options.services && options.services.length > 0) {
    await orchestrator.start();
  }

  const app = options.app();
  const database = options.database ?? orchestrator.getDatabase() ?? undefined;

  let url = options.url;
  let httpServer: null | ReturnType<typeof serve> = null;

  if (!url) {
    // Start HTTP server automatically
    const port = options.port ?? 9800 + Math.floor(Math.random() * 100);
    httpServer = serve({ fetch: app.fetch, port });
    url = `http://localhost:${port}`;
  }

  const runner = createSpecificationRunner({
    database,
    server: new FetchAdapter(url),
  }) as SpecificationRunnerWithCleanup;

  runner.cleanup = async () => {
    httpServer?.close();
    await orchestrator.stop();
  };
  runner.orchestrator = orchestrator;

  return runner;
}

// Service factories
export { postgres } from "../infrastructure/services/postgres.js";
export { redis } from "../infrastructure/services/redis.js";

// Types
export type { DatabasePort } from "./ports/database.port.js";
export type { ServerPort, ServerResponse } from "./ports/server.port.js";

// Adapters (for advanced usage)
export { FetchAdapter } from "./adapters/fetch.adapter.js";
export { HonoAdapter } from "./adapters/hono.adapter.js";
export { Orchestrator } from "../infrastructure/orchestrator.js";

// Runners
export { e2e, integration };
