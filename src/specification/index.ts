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
  /** Declared services — started via testcontainers. */
  services: ServiceHandle[];
  /** Factory that returns a Hono app — called after services start. */
  app: () => HonoApp;
  /** Project root for compose detection (relative paths supported). */
  projectRoot?: string;
}

interface E2eOptions {
  /** Project root — must contain docker/compose.test.yaml. */
  projectRoot?: string;
}

interface SpecificationRunnerWithCleanup extends SpecificationRunner {
  cleanup: () => Promise<void>;
  orchestrator: Orchestrator;
}

/**
 * Create an integration specification runner.
 * Starts infra containers via testcontainers, app runs in-process.
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
    services: options.services,
    mode: "integration",
    projectRoot: resolveProjectRoot(options.projectRoot),
  });

  await orchestrator.start();

  const app = options.app();
  const database = orchestrator.getDatabase() ?? undefined;

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
 * Starts full docker compose stack. App URL and database auto-detected.
 *
 * @example
 * export const spec = await e2e({
 *     projectRoot: "../fixtures/app",
 * });
 */
async function e2e(options: E2eOptions = {}): Promise<SpecificationRunnerWithCleanup> {
  const orchestrator = new Orchestrator({
    services: [],
    mode: "e2e",
    projectRoot: resolveProjectRoot(options.projectRoot),
  });

  await orchestrator.startCompose();

  const appUrl = orchestrator.getAppUrl();
  if (!appUrl) {
    throw new Error(
      "E2E: could not detect app URL from compose. Ensure an app service with ports is defined.",
    );
  }

  const database = orchestrator.getDatabase() ?? undefined;

  const runner = createSpecificationRunner({
    database,
    server: new FetchAdapter(appUrl),
  }) as SpecificationRunnerWithCleanup;

  runner.cleanup = () => orchestrator.stopCompose();
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
