import { dirname } from "node:path";

import type { DatabasePort } from "../specification/ports/database.port.js";
import { ComposeStackAdapter } from "./adapters/compose.adapter.js";
import { TestcontainersAdapter } from "./adapters/testcontainers.adapter.js";
import { findComposeFile, parseComposeFile } from "./compose-parser.js";
import type { ContainerPort } from "./ports/container.port.js";
import { printReport } from "./reporter.js";
import type { ServiceHandle } from "./services/service.port.js";

interface RunningService {
  handle: ServiceHandle;
  container: ContainerPort | null;
}

interface OrchestratorOptions {
  services: ServiceHandle[];
  mode: "e2e" | "integration";
  projectRoot?: string;
}

/**
 * Orchestrator for test infrastructure.
 * Starts services, populates connection strings, reports status.
 */
export class Orchestrator {
  private services: ServiceHandle[];
  private mode: "e2e" | "integration";
  private projectRoot: string;
  private running: RunningService[] = [];
  private composeStack: ComposeStackAdapter | null = null;
  private started = false;

  constructor(options: OrchestratorOptions) {
    this.services = options.services;
    this.mode = options.mode;
    this.projectRoot = options.projectRoot ?? process.cwd();
  }

  /**
   * Start all declared services.
   */
  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    const composePath = findComposeFile(this.projectRoot);
    const composeDir = composePath ? dirname(composePath) : this.projectRoot;
    const composeConfig = composePath ? parseComposeFile(composePath) : null;

    const reports: { handle: ServiceHandle; durationMs: number; error?: string }[] = [];

    for (const handle of this.services) {
      const startTime = Date.now();

      try {
        // SQLite: in-process, no container
        if (handle.type === "sqlite") {
          if ("start" in handle && typeof handle.start === "function") {
            await (handle as any).start();
          }
          handle.started = true;
          reports.push({ handle, durationMs: Date.now() - startTime });
          this.running.push({ handle, container: null });
          continue;
        }

        // Resolve config from compose if linked
        let image = handle.defaultImage;
        let env = { ...handle.environment };

        if (handle.composeName && composeConfig) {
          const composeService = composeConfig.services.find((s) => s.name === handle.composeName);
          if (composeService) {
            image = composeService.image ?? image;
            env = { ...env, ...composeService.environment };
          }
        }

        if (this.mode === "e2e" && composePath) {
          // E2E: use docker compose
          if (!this.composeStack) {
            this.composeStack = new ComposeStackAdapter(composePath);
            await this.composeStack.start();
          }

          const port = this.composeStack.getMappedPort(
            handle.composeName ?? handle.type,
            handle.defaultPort,
          );
          handle.connectionString = handle.buildConnectionString("localhost", port);
        } else {
          // Integration: use testcontainers
          const container = new TestcontainersAdapter({
            image,
            port: handle.defaultPort,
            env,
          });
          await container.start();

          const host = container.getHost();
          const port = container.getMappedPort(handle.defaultPort);
          handle.connectionString = handle.buildConnectionString(host, port);

          this.running.push({ handle, container });
        }

        await handle.initialize(composeDir);
        handle.started = true;
        reports.push({ handle, durationMs: Date.now() - startTime });
      } catch (error: any) {
        reports.push({
          handle,
          durationMs: Date.now() - startTime,
          error: error.message,
        });
        throw error;
      }
    }

    this.started = true;
    printReport(this.mode, reports);
  }

  /**
   * Stop all running containers.
   */
  async stop(): Promise<void> {
    for (const { container } of this.running) {
      if (container) {
        await container.stop();
      }
    }

    if (this.composeStack) {
      await this.composeStack.stop();
    }

    this.running = [];
    this.started = false;
  }

  /**
   * Get the first database service (for the specification runner).
   */
  getDatabase(): DatabasePort | null {
    for (const handle of this.services) {
      const adapter = handle.createDatabaseAdapter();
      if (adapter) {
        return adapter;
      }
    }
    return null;
  }

  /**
   * Get the app URL from compose (for e2e mode).
   */
  getAppUrl(): null | string {
    const composePath = findComposeFile(this.projectRoot);
    if (!composePath) {
      return null;
    }

    const config = parseComposeFile(composePath);
    const appService = config.appService;

    if (!appService || appService.ports.length === 0) {
      return null;
    }

    if (this.composeStack) {
      const port = this.composeStack.getMappedPort(appService.name, appService.ports[0].container);
      return `http://localhost:${port}`;
    }

    const port = appService.ports[0].host ?? appService.ports[0].container;
    return `http://localhost:${port}`;
  }
}
