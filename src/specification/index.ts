import { Orchestrator } from "../infrastructure/orchestrator.js";
import { FetchAdapter } from "./adapters/fetch.adapter.js";
import { HonoAdapter } from "./adapters/hono.adapter.js";
import type { DatabasePort } from "./ports/database.port.js";
import { createSpecificationRunner, type SpecificationRunner } from "./specification.js";

interface IntegrationOptions {
  /** Hono app instance for in-process requests. */
  app: { request: (path: string, init?: RequestInit) => Promise<Response> };
  /** Override auto-detected database adapter. */
  database?: DatabasePort;
  /** Project root for docker-compose.test.yaml detection. Defaults to cwd. */
  projectRoot?: string;
}

interface E2eOptions {
  /** Override auto-detected app URL. */
  url?: string;
  /** Override auto-detected database adapter. */
  database?: DatabasePort;
  /** Project root for docker-compose.test.yaml detection. Defaults to cwd. */
  projectRoot?: string;
}

interface SpecificationRunnerWithCleanup extends SpecificationRunner {
  /** Stop all containers started by the orchestrator. */
  cleanup: () => Promise<void>;
  /** The orchestrator instance (for accessing connection strings, etc.) */
  orchestrator: Orchestrator;
}

/**
 * Create an integration specification runner.
 * Starts infra containers from docker-compose.test.yaml (if found).
 * App runs in-process via the Hono instance.
 */
async function integration(options: IntegrationOptions): Promise<SpecificationRunnerWithCleanup> {
  const projectRoot = options.projectRoot ?? process.cwd();
  const orchestrator = new Orchestrator(projectRoot);

  if (orchestrator.hasComposeFile()) {
    await orchestrator.start();
  }

  const database = options.database ?? orchestrator.getDatabase() ?? undefined;

  const runner = createSpecificationRunner({
    database,
    server: new HonoAdapter(options.app),
  }) as SpecificationRunnerWithCleanup;

  runner.cleanup = () => orchestrator.stop();
  runner.orchestrator = orchestrator;

  return runner;
}

/**
 * Create an E2E specification runner.
 * Starts all containers from docker-compose.test.yaml (including the app).
 * Requests are real HTTP against the running app.
 */
async function e2e(options: E2eOptions = {}): Promise<SpecificationRunnerWithCleanup> {
  const projectRoot = options.projectRoot ?? process.cwd();
  const orchestrator = new Orchestrator(projectRoot);

  if (orchestrator.hasComposeFile()) {
    await orchestrator.start();
    // TODO: For full e2e, also start the app container via docker compose up
  }

  const database = options.database ?? orchestrator.getDatabase() ?? undefined;
  const url = options.url ?? orchestrator.getAppUrl() ?? "http://localhost:3000";

  const runner = createSpecificationRunner({
    database,
    server: new FetchAdapter(url),
  }) as SpecificationRunnerWithCleanup;

  runner.cleanup = () => orchestrator.stop();
  runner.orchestrator = orchestrator;

  return runner;
}

export type { DatabasePort } from "./ports/database.port.js";
export type { ServerPort, ServerResponse } from "./ports/server.port.js";
export { FetchAdapter } from "./adapters/fetch.adapter.js";
export { HonoAdapter } from "./adapters/hono.adapter.js";
export { PrismaAdapter } from "./adapters/prisma.adapter.js";
export { Orchestrator } from "../infrastructure/orchestrator.js";
export { e2e, integration };
