import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

import { Orchestrator } from "../infrastructure/orchestrator.js";
import type { ServiceHandle } from "../infrastructure/services/service.port.js";
import { ExecAdapter } from "./adapters/exec.adapter.js";
import { FetchAdapter } from "./adapters/fetch.adapter.js";
import { HonoAdapter } from "./adapters/hono.adapter.js";
import type { DatabasePort } from "./ports/database.port.js";
import { createSpecificationRunner, type SpecificationRunner } from "./specification.js";

/**
 * Resolve root — if relative, resolves from the caller's directory.
 */
function resolveProjectRoot(root: string | undefined): string {
  if (!root) {
    return process.cwd();
  }

  if (isAbsolute(root)) {
    return root;
  }

  const stack = new Error("resolve root").stack;
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

      return resolve(filePath, "..", root);
    }
  }

  return resolve(process.cwd(), root);
}

/**
 * Resolve a CLI command — checks node_modules/.bin, then treats as absolute/PATH.
 */
function resolveCommand(command: string, root: string): string {
  if (isAbsolute(command)) {
    return command;
  }

  // Check node_modules/.bin in fixture root
  const binPath = resolve(root, "node_modules/.bin", command);
  if (existsSync(binPath)) {
    return binPath;
  }

  // Check project root node_modules/.bin
  const cwdBinPath = resolve(process.cwd(), "node_modules/.bin", command);
  if (existsSync(cwdBinPath)) {
    return cwdBinPath;
  }

  // Treat as PATH command or absolute
  return command;
}

type HonoApp = {
  fetch: (...args: any[]) => any;
  request: (path: string, init?: RequestInit) => Promise<Response> | Response;
};

export interface IntegrationOptions {
  /** Factory that returns a Hono app — called after services start. */
  app: () => HonoApp;
  /** Project root for compose detection (relative paths supported). */
  root?: string;
  /** Declared services — started via testcontainers. */
  services: ServiceHandle[];
}

export interface E2eOptions {
  /** Project root — must contain docker/compose.test.yaml. */
  root?: string;
}

export interface CliOptions {
  /** CLI command to run (resolved from node_modules/.bin or PATH). */
  command: string;
  /** Project root — base dir for .project() fixture lookup (relative paths supported). */
  root?: string;
  /** Optional infrastructure services (started via testcontainers). */
  services?: ServiceHandle[];
}

export interface SpecificationRunnerWithCleanup extends SpecificationRunner {
  cleanup: () => Promise<void>;
  orchestrator: Orchestrator;
}

/**
 * Create an integration specification runner.
 * Starts infra containers via testcontainers, app runs in-process.
 */
async function integration(options: IntegrationOptions): Promise<SpecificationRunnerWithCleanup> {
  const orchestrator = new Orchestrator({
    mode: "integration",
    root: resolveProjectRoot(options.root),
    services: options.services,
  });

  await orchestrator.start();

  const app = options.app();
  const database = orchestrator.getDatabase() ?? undefined;
  const databases = orchestrator.getDatabases();

  const runner = createSpecificationRunner({
    database,
    databases: databases.size > 0 ? databases : undefined,
    server: new HonoAdapter(app),
  }) as SpecificationRunnerWithCleanup;

  runner.cleanup = () => orchestrator.stop();
  runner.orchestrator = orchestrator;

  return runner;
}

/**
 * Create an E2E specification runner.
 * Starts full docker compose stack. App URL and database auto-detected.
 */
async function e2e(options: E2eOptions = {}): Promise<SpecificationRunnerWithCleanup> {
  const orchestrator = new Orchestrator({
    mode: "e2e",
    root: resolveProjectRoot(options.root),
    services: [],
  });

  await orchestrator.startCompose();

  const appUrl = orchestrator.getAppUrl();
  if (!appUrl) {
    throw new Error(
      "E2E: could not detect app URL from compose. Ensure an app service with ports is defined.",
    );
  }

  const database = orchestrator.getDatabase() ?? undefined;
  const databases = orchestrator.getDatabases();

  const runner = createSpecificationRunner({
    database,
    databases: databases.size > 0 ? databases : undefined,
    server: new FetchAdapter(appUrl),
  }) as SpecificationRunnerWithCleanup;

  runner.cleanup = () => orchestrator.stopCompose();
  runner.orchestrator = orchestrator;

  return runner;
}

/**
 * Create a CLI specification runner.
 * Runs CLI commands against fixture projects. Optionally starts infrastructure.
 *
 * @example
 * export const spec = await cli({
 *     command: resolve(import.meta.dirname, "../../bin/my-cli.sh"),
 *     root: "../fixtures",
 * });
 */
async function cli(options: CliOptions): Promise<SpecificationRunnerWithCleanup> {
  const root = resolveProjectRoot(options.root);
  const command = resolveCommand(options.command, root);

  let orchestrator: null | Orchestrator = null;
  let database: DatabasePort | undefined;
  let databases: Map<string, DatabasePort> | undefined;

  if (options.services?.length) {
    orchestrator = new Orchestrator({
      mode: "integration",
      root,
      services: options.services,
    });
    await orchestrator.start();
    database = orchestrator.getDatabase() ?? undefined;
    const dbMap = orchestrator.getDatabases();
    databases = dbMap.size > 0 ? dbMap : undefined;
  }

  const runner = createSpecificationRunner({
    command: new ExecAdapter(command),
    database,
    databases,
    fixturesRoot: root,
  }) as SpecificationRunnerWithCleanup;

  runner.cleanup = async () => {
    if (orchestrator) {
      await orchestrator.stop();
    }
  };
  runner.orchestrator = orchestrator!;

  return runner;
}

// Service factories
export { postgres, type PostgresOptions } from "../infrastructure/services/postgres.js";
export { redis, type RedisOptions } from "../infrastructure/services/redis.js";

// Types
export type { CommandEnv, CommandPort, CommandResult, SpawnOptions } from "./ports/command.port.js";
export type { DatabasePort } from "./ports/database.port.js";
export type { ServiceHandle } from "../infrastructure/services/service.port.js";
export type { ServerPort, ServerResponse } from "./ports/server.port.js";
export type {
  DirectoryAccessor,
  DirectorySnapshotOptions,
  FileAccessor,
  ResponseAccessor,
  SpecificationBuilder,
  SpecificationResult,
  TableAssertion,
} from "./specification.js";

// Adapters (for advanced usage)
export { ExecAdapter } from "./adapters/exec.adapter.js";
export { FetchAdapter } from "./adapters/fetch.adapter.js";
export { HonoAdapter } from "./adapters/hono.adapter.js";
export { Orchestrator } from "../infrastructure/orchestrator.js";

// Utilities
export { grep } from "./grep.js";
export { normalizeOutput, stripAnsi } from "../infrastructure/reporter.js";

// Runners
export { cli, e2e, integration };
