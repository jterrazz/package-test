import { dirname } from "node:path";

import type { DatabasePort } from "../specification/ports/database.port.js";
import { ComposeStackAdapter } from "./adapters/compose.adapter.js";
import { TestcontainersAdapter } from "./adapters/testcontainers.adapter.js";
import { detectServiceType, findComposeFile, parseComposeFile } from "./compose-parser.js";
import type { ContainerPort } from "./ports/container.port.js";
import { printReport } from "./reporter.js";
import { postgres } from "./services/postgres.js";
import type { ServiceHandle } from "./services/service.port.js";

interface RunningService {
  handle: ServiceHandle;
  container: ContainerPort | null;
}

interface OrchestratorOptions {
  services: ServiceHandle[];
  mode: "e2e" | "integration";
  root?: string;
}

/**
 * Orchestrator for test infrastructure.
 * Integration: starts services via testcontainers.
 * E2E: runs full docker compose up.
 */
export class Orchestrator {
  private services: ServiceHandle[];
  private mode: "e2e" | "integration";
  private root: string;
  private running: RunningService[] = [];
  private composeStack: ComposeStackAdapter | null = null;
  private composeHandles: ServiceHandle[] = [];
  private started = false;

  constructor(options: OrchestratorOptions) {
    this.services = options.services;
    this.mode = options.mode;
    this.root = options.root ?? process.cwd();
  }

  /**
   * Start declared services via testcontainers (integration mode).
   * Reads image/env config from docker-compose.test.yaml if a service has compose: "name".
   */
  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    const composePath = findComposeFile(this.root);
    const composeDir = composePath ? dirname(composePath) : this.root;
    const composeConfig = composePath ? parseComposeFile(composePath) : null;

    const reports: { handle: ServiceHandle; durationMs: number; error?: string }[] = [];

    for (const handle of this.services) {
      const startTime = Date.now();

      try {
        let image = handle.defaultImage;
        let env = { ...handle.environment };

        if (handle.composeName && composeConfig) {
          const composeService = composeConfig.services.find((s) => s.name === handle.composeName);
          if (composeService) {
            image = composeService.image ?? image;
            env = { ...env, ...composeService.environment };
          }
        }

        const container = new TestcontainersAdapter({ image, port: handle.defaultPort, env });
        await container.start();

        const host = container.getHost();
        const port = container.getMappedPort(handle.defaultPort);
        handle.connectionString = handle.buildConnectionString(host, port);

        // Healthcheck — verify service is ready
        await handle.healthcheck();

        // Init scripts — fail fast with context
        await handle.initialize(composeDir);
        handle.started = true;

        reports.push({ handle, durationMs: Date.now() - startTime });
        this.running.push({ handle, container });
      } catch (error: any) {
        // Capture container logs on failure
        const lastContainer = this.running.at(-1)?.container;
        let logs = "";
        if (lastContainer) {
          try {
            logs = await lastContainer.getLogs();
          } catch {
            /* Ignore log fetch errors */
          }
        }

        const errorWithLogs = logs
          ? `${error.message}\n\n┌ Container logs ─────────────────────\n${logs
              .split("\n")
              .slice(-15)
              .map((l: string) => `│ ${l}`)
              .join("\n")}\n└─────────────────────────────────────`
          : error.message;

        reports.push({ handle, durationMs: Date.now() - startTime, error: errorWithLogs });
        throw new Error(errorWithLogs, { cause: error });
      }
    }

    this.started = true;
    printReport("integration", reports, { type: "in-process" });
  }

  /**
   * Stop testcontainers (integration mode).
   */
  async stop(): Promise<void> {
    for (const { container } of this.running) {
      if (container) {
        await container.stop();
      }
    }
    this.running = [];
    this.started = false;
  }

  /**
   * Start full docker compose stack (e2e mode).
   * Auto-detects infra services and creates handles for them.
   */
  async startCompose(): Promise<void> {
    const composePath = findComposeFile(this.root);
    if (!composePath) {
      throw new Error(`E2E: no compose file found in ${this.root}`);
    }

    const startTime = Date.now();
    const composeDir = dirname(composePath);
    const composeConfig = parseComposeFile(composePath);

    this.composeStack = new ComposeStackAdapter(composePath);
    await this.composeStack.start();

    // Create handles for detected infra services
    for (const service of composeConfig.infraServices) {
      const type = detectServiceType(service.image);

      if (type === "postgres") {
        const handle = postgres({ compose: service.name });
        const port = this.composeStack.getMappedPort(service.name, 5432);
        const env = { ...handle.environment, ...service.environment };
        handle.connectionString = handle.buildConnectionString("localhost", port);

        // Override env from compose
        Object.assign(handle.environment, env);

        await handle.initialize(composeDir);
        handle.started = true;

        this.composeHandles.push(handle);
      }
    }

    const durationMs = Date.now() - startTime;
    const reports = this.composeHandles.map((h) => ({ handle: h, durationMs }));
    printReport("e2e", reports, {
      type: "http",
      url: this.getAppUrl() ?? undefined,
    });
  }

  /**
   * Stop docker compose stack (e2e mode).
   */
  async stopCompose(): Promise<void> {
    if (this.composeStack) {
      await this.composeStack.stop();
      this.composeStack = null;
    }
    this.composeHandles = [];
  }

  /**
   * Get the first database service.
   */
  getDatabase(): DatabasePort | null {
    // Check testcontainer handles first, then compose handles
    for (const handle of [...this.services, ...this.composeHandles]) {
      const adapter = handle.createDatabaseAdapter();
      if (adapter) {
        return adapter;
      }
    }
    return null;
  }

  /**
   * Get app URL from compose (e2e mode).
   */
  getAppUrl(): null | string {
    const composePath = findComposeFile(this.root);
    if (!composePath || !this.composeStack) {
      return null;
    }

    const config = parseComposeFile(composePath);
    const appService = config.appService;

    if (!appService || appService.ports.length === 0) {
      return null;
    }

    const port = this.composeStack.getMappedPort(appService.name, appService.ports[0].container);
    return `http://localhost:${port}`;
  }
}
